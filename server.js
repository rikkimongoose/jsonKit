const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const Joi = require('joi');
const configSchema = require('./config.schema');
const { verify } = require('crypto');

require('dotenv').config()

// Определение режима разработки
const isDev = process.env.NODE_ENV === 'development';
// Инициализация конфига
let config = loadConfig();

function loadConfig() {
  try {
    const rawConfig = fs.readFileSync('./config.json', 'utf-8');
    const parsedConfig = JSON.parse(rawConfig);

    const { error, value } = configSchema.validate(parsedConfig, { abortEarly: false });
    if (error) {
      console.error('Ошибка в config.json:');
      error.details.forEach(err => console.error(`- ${err.message}`));
      process.exit(1);
    }

    if (isDev) {
      console.log('[DEV] Конфиг загружен. Текущий путь:', value.navigation.filepath);
    }
    return value;
  } catch (err) {
    console.error('Ошибка чтения config.json:', err.message);
    process.exit(1);
  }
}

const liveReloadHeader = {
    'Content-Type':'text/event-stream',
    'Cache-Control':"Ken",
    'Connection':'keep-alive'
};

function makeLiveReload(res) {
    for (let header in liveReloadHeader) {
        res.setHeader(header, liveReloadHeader[header]);
    }
}

// Создание Express-приложения
const app = express();

// Middleware для режима разработки
if (isDev) {
  const morgan = require('morgan');
  app.use(morgan('dev')); // Логирование запросов
  
  // SSE endpoint для live-reload фронтенда
  app.get('/sse', (req, res) => {
    makeLiveReload(res);
    
    const watcher = chokidar.watch('./public', {
      ignored: /(^|[\/\\])\../, // игнорировать скрытые файлы
      persistent: true
    });

    watcher.on('change', (path) => {
      console.log(`[DEV] Файл изменён: ${path}`);
      res.write('data: reload\n\n');
    });

    req.on('close', () => {
      watcher.close();
    });
  });
}

// Раздача статических файлов
app.use(express.static(path.join(__dirname, config.server.staticFiles)));

// Основной endpoint для конфига
app.get('/config', (req, res) => {
  res.json({
    title: config.app.title,
    version: config.app.version,
    filepath: config.navigation.filepath,
    isDev: isDev
  });
});

// Отслеживание изменений конфига
const configWatcher = chokidar.watch('./config.json', {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

const loadDir = async (absolutePath) => {
    // Безопасность: проверяем, что путь внутри разрешённой директории
    if (absolutePath.startsWith(path.resolve(config.server.staticFiles))) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const items = await fs.readdir(absolutePath, { withFileTypes: true });
    const resultDir = [];
    const resultFiles = [];

    for (const item of items) {
        const localPath = path.join(item.parentPath, item.name);
        if (item.isDirectory()) {
            const subDir = await loadDir(localPath)
            // Добавляем директорию
            resultDir.push({
                title: item.name,
                folder: true,
                key: localPath,
                type: 'directory',
                children: subDir
            });
        } else if (item.name.endsWith('.json')) {
            // Добавляем только JSON-файлы
            resultFiles.push({
                title: item.name,
                key: localPath,
                type: 'file'
            });
        }
    }

    // Сортируем: сначала директории, потом файлы
    const sortByName = (a, b) => a.title.localeCompare(b.title);
    resultDir.sort(sortByName);
    resultFiles.sort(sortByName);
    result = resultDir.concat(resultFiles);
    return result;
}

app.get('/api/files', async (req, res) => {
    try {
        const absolutePath = req.query.path;
        const result = await loadDir(absolutePath)
        res.json(result);
    } catch (error) {
        console.error('Ошибка при чтении директории:', error);
        res.status(500).json({ 
            error: 'Не удалось прочитать директорию',
            details: error.message 
        });
    }
});

app.get('/api/file', async (req, res) => {
    const absolutePath = req.query.path;
    if (!absolutePath || !absolutePath.endsWith('.json')) {
        res.status(400).json({ error: 'Укажите путь к JSON-файлу' });
    }
    
    if (absolutePath.startsWith(path.resolve(config.server.staticFiles))) {
        res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    fs.readFile(absolutePath, 'utf-8', (err, content) => {
      const errorMessageText = `Ошибка чтения файла: ${absolutePath}`
      if (err) {
        const jsonErr = { 
            error: errorMessageText,
            details: error.message 
        }
        console.error(jsonErr)
        res.status(500).json(jsonErr);
      }
      try {
        JSON.parse(content);
      } catch (error) {
          const parseErr = { 
              error: error instanceof SyntaxError ? `Невалидный JSON: ${content}` : errorMessageText,
              details: error.message 
          }
          console.error(jsonErr)
          res.status(500).json(jsonErr);
      }
      // Валидация JSON
      res.type('application/json').send(content);
    });
});

app.post('/api/file', express.json(), async (req, res) => {
    const requestedPath = req.query.path;
    if (!requestedPath.endsWith('.json')) {
        res.status(400).json({ error: 'Можно сохранять только JSON-файлы' });
    }
    const absolutePath = path.resolve(requestedPath);
    if (absolutePath.startsWith(path.resolve(config.server.staticFiles))) {
        res.status(403).json({ error: 'Доступ запрещён' });
    }
    fs.writeFile(absolutePath, JSON.stringify(req.body, null, 2), (err) => {
      if (err) {
        const jsonErr = { error: err.message }
        console.error(jsonErr)
        res.status(500).json(jsonErr);
      }
      res.json({ success: true });
    });
});

app.post('/api/file/rename', express.json(), async (req, res) => {
      const { pathOld, pathNew } = req.body;
      const pathsToCheck = [pathOld, pathNew]

      // Проверка безопасности путей
      const basePath = path.resolve(config.server.staticFiles);

      pathsToCheck.forEach(filePath => {
          // Проверка обязательных параметров
          if (!filePath) {
              res.status(400).json({ error: 'Не указаны pathOld или pathNew' });
          }
          if (filePath.startsWith(path.resolve(basePath))) {
              res.status(403).json({ error: 'Доступ запрещён' });
          }           
      });
      // Выполняем переименование
      fs.rename(absolutePathOld, absolutePathNew, err => {
        if (err) {
          console.error('Ошибка переименования:', err);
          res.status(500).json({ 
              error: `Ошибка при переименовании ${absolutePathOld} в ${absolutePathNew}`,
              details: error.message 
          });
        }
        res.json({ 
            success: true,
            message: 'Успешно переименовано',
            pathOld: pathOld,
            pathNew: pathNew
        });
      });
});

app.delete('/api/file', async (req, res) => {
    const requestedPath = req.query.path;
    if (!requestedPath) {
        res.status(400).json({ error: 'Не указан путь' });
    }

    const basePath = path.resolve(config.server.staticFiles);
    const absolutePath = path.resolve(requestedPath);

    // Проверка безопасности пути
    if (absolutePath.startsWith(basePath)) {
        res.status(403).json({ error: 'Доступ запрещён' });
    }

    fs.stat(absolutePath, (err, stats) => {
      if (err) {
        console.error('Ошибка удаления:', err);
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Файл или директория не найдены' });
        } else {
            res.status(500).json({ 
                error: 'Ошибка при удалении',
                details: err.message 
            });
        }
      }
      const messageOK = { success: true, message: `Удаление ${requestedPath} успешно` }
      const messageErrText = `Ошибка при удалении ${requestedPath}`
      if (stats.isDirectory()) {
        // Удаление директории
        fs.rmdir(absolutePath, { recursive: true }, err => {
            if (err) {
              res.status(500).json({ 
                error: messageErrText,
                details: err.message 
              });
            }
            res.json(messageOK);
          });
        } else {
          // Удаление файла
          fs.unlink(absolutePath, err => {
            if (err) {
              res.status(500).json({ 
                error: messageErrText,
                details: err.message 
              });
            }
            res.json(messageOK);
          });
      }
    });
});

configWatcher.on('change', () => {
  console.log('\n[DEV] Обнаружено изменение конфига');
  const oldPort = config.server.port;
  config = loadConfig();

  if (oldPort !== config.server.port) {
    console.log('[DEV] Порт изменился. Требуется перезапуск сервера.');
  }
});

// Запуск сервера
const server = app.listen(config.server.port, () => {
  console.log(`Сервер запущен на http://localhost:${config.server.port}`);
  if (isDev) {
    console.log('[DEV] Режим разработки активен');
    console.log('[DEV] Отслеживаются изменения в:');
    console.log('  - server.js');
    console.log('  - config.json');
    console.log('  - public/');
  }
});