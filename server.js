const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const Joi = require('joi');
const WebSocket = require('ws');
const jsonpath = require('jsonpath');
const _ = require('lodash');

const configSchema = require('./config.schema');

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
      console.log('[DEV] Конфиг загружен. Текущий путь:', value.navigation.jsonDirectory);
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
    _.forOwn(liveReloadHeader, (value, header) => res.setHeader(header, value));
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

function loadCurrentJsonDir(config) {
  return process.env.JSON_DIR || config.navigation.jsonDirectory;
}

// Основной endpoint для конфига
app.get('/config', (req, res) => {
  const jsonDir = loadCurrentJsonDir(config);
  res.json({
    version: config.app.version,
    jsonDirectory: jsonDir,
    jsonDirectoryFull: path.resolve(jsonDir),
    extData: config.navigation.extData,
    portWss: config.server.portWss,
    extDataFilterSize: config.navigation.extDataFilterSize,
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

function parseJson(jsonSource) {
  try {
    return JSON.parse(jsonSource);
  } catch (error) {
    console.error(`Ошибка при разборе JSON: ${error.message}`);
    return null;
  }
}

function readFile(localPath) {
  try {
    // Пытаемся загрузить данные из файла
    return fs.readFileSync(localPath, 'utf-8');
  } catch (error) {
    // В случае ошибки выводим её в console.error
    console.error(`Ошибка при чтении файла: ${error.message}`);
    return null; // Возвращаем null, если произошла ошибка
  }
}

function loadExtData(extData, localPath) {
    if(!extData) {
      return null;
    }
    const jsonSource = readFile(localPath);
    if(!jsonSource) {
      return null;
    }
    const jsonData = parseJson(jsonSource);
    if(!jsonData) {
      return null;
    }

    const resultData = {};
    // Перебор всех собственных свойств объекта
    _.forOwn(extData, (jsonCmd, key) => {
      const result = jsonpath.query(jsonData, jsonCmd);
      resultData[key] = [...new Set(result)];
    });
    return resultData;
}

const loadDir = async (absolutePath) => {
    // Безопасность: проверяем, что путь внутри разрешённой директории
    if (absolutePath.startsWith(path.resolve(config.server.staticFiles))) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const items = await fs.readdir(absolutePath, { withFileTypes: true });
    const resultDir = [];
    const resultFiles = [];
    for (const item of items) {
        const localDirPath = path.resolve(item.parentPath);
        const localPath = path.join(localDirPath, item.name);
        if (item.isDirectory()) {
            const subDir = await loadDir(localPath);
            // Добавляем директорию
            resultDir.push({
                title: item.name,
                folder: true,
                key: localPath,
                type: 'directory',
                children: subDir,
                extData: {}
            });
        } else if (item.name.endsWith('.json')) {
            const extData = loadExtData(config.navigation.extData, localPath);
            // Добавляем только JSON-файлы
            resultFiles.push({
                title: item.name,
                key: localPath,
                type: 'file',
                extData: extData
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

app.post('/api/files', express.json(), async (req, res) => {
  const requestedPath = req.query.path;
  const absolutePath = path.resolve(requestedPath);
  if (absolutePath.startsWith(path.resolve(config.server.staticFiles))) {
      res.status(403).json({ error: 'Доступ запрещён' });
  }
  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName, { recursive: true} );
    }
  } catch (err) {
    console.error(err);
  }
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
        fs.rm(absolutePath, { recursive: true, force: true }, err => {
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


// Создаем WebSocket сервер
const wss = new WebSocket.Server({ port: config.server.portWss });

// Функция для отправки сообщений всем подключенным клиентам
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Инициализация watcher
const watcher = chokidar.watch(config.navigation.jsonDirectory, {
  ignored: /(^|[\/\\])\../, // игнорируем скрытые файлы
  persistent: true,
  ignoreInitial: true, // игнорируем начальное сканирование
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

// Обработчики событий watcher
watcher
  .on('add', filePath => {
    if (filePath.endsWith('.json') || !path.extname(filePath)) {

      const extData = loadExtData(config.navigation.extData, filePath);
      broadcast({
        type: 'add',
        path: path.resolve(filePath),
        basename: path.basename(filePath),
        isDirectory: false,
        extData: extData,
        time: new Date().toISOString()
      });
    }
  })
  .on('addDir', dirPath => {
    broadcast({
      type: 'addDir',
      path: path.resolve(dirPath),
      isDirectory: true,
      time: new Date().toISOString()
    });
  })
  .on('change', filePath => {
    if (filePath.endsWith('.json')) {
      const extData = loadExtData(config.navigation.extData, filePath);
      broadcast({
        type: 'change',
        path: path.resolve(filePath),
        extData: extData,
        isDirectory: false,
        time: new Date().toISOString()
      });
    }
  })
  .on('unlink', filePath => {
    if (filePath.endsWith('.json') || !path.extname(filePath)) {
      broadcast({
        type: 'unlink',
        path: path.resolve(filePath),
        isDirectory: !path.extname(filePath),
        time: new Date().toISOString()
      });
    }
  })
  .on('unlinkDir', dirPath => {
    broadcast({
      type: 'unlinkDir',
      path: path.resolve(dirPath),
      isDirectory: true,
      time: new Date().toISOString()
    });
  })
  .on('error', error => {
    console.error('Watcher error:', error);
  })
  .on('ready', () => {
    console.log(`Initial scan complete. Ready for changes in ${config.navigation.jsonDirectory}`);
  });
