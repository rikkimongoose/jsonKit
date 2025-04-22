const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const Joi = require('joi');
const WebSocket = require('ws');
const jsonpath = require('jsonpath');
const _ = require('lodash');

const configSchema = require('./config.schema');
const { runInThisContext } = require('vm');

require('dotenv').config()

// Определение режима разработки
const isDev = process.env.NODE_ENV === 'development';
// Инициализация конфига
let config = loadConfig();

function loadDefaultServerConfig() {
  const staticFilesPath = "./public";
  return {
    staticFilesPath,
    staticFilesResolved: path.resolve(staticFilesPath),
  }
}

const ServerConfig = loadDefaultServerConfig();

class PathValidator {
    constructor(res, absolutePaths) {
        this.res = res;
        this.valid = true; // Флаг валидности
        if(absolutePaths.some(absolutePath => _.isEmpty(absolutePath))) {
            const msg = "Путь не может быть пустым";
            console.error(msg);
            res.status(400).json({ error: msg });
            this.absolutePaths = [];
            this.valid = false;
        } else {
            this.absolutePaths = absolutePaths.map(absolutePath => path.resolve(absolutePath.trim()));
        }
    }

    get path() {
        return this.absolutePaths.length ? this.absolutePaths[0] : "";
    }

    get isValid() {
      return this.valid
    }

    isJson() {
      if(!this.valid) {
        return this;
      }
      if (!this.absolutePaths.some(absolutePath => absolutePath.endsWith('.json'))) {
          const msg = `Неверный JSON-файл: ${absolutePath}. Требуется файл с расширением .json`;
          console.error(msg);
          this.res.status(400).json({ error: msg });
          this.valid = false;
      }
      return this;
    }

    isAllowed() {
      if(!this.valid) {
        return this;
      }
      if(this.absolutePaths.some(absolutePath => absolutePath.startsWith(ServerConfig.staticFilesPathResolved))) {
          console.log         
          this.res.status(403).json({ error: 'Доступ запрещён' });
          this.valid = false;
      }
      const jsonDirectoryResolved = path.resolve(config.navigation.jsonDirectory)
      if(!this.absolutePaths.some(absolutePath => absolutePath.startsWith(jsonDirectoryResolved))) {
          this.res.status(403).json({ error: 'Доступ запрещён' });
          this.valid = false;
      }
      return this;
    }

    // Если валидация успешна — вызывает callback
    then(callback) {
      if (this.isValid) callback(this.absolutePaths.length > 1 ? this.absolutePaths : this.absolutePaths[0]);
      return this; // Можно продолжить цепочку, если нужно
    }
}

function checkAccess(res, absolutePath) {
  return AccessHelper.hasAccess(AccessHelper.check(absolutePath), res);
}

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
app.use(express.static(path.join(__dirname, ServerConfig.staticFilesPath)));
app.use('/modules', express.static(path.join(__dirname, 'node_modules')));

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
      resultData[key] = _.uniq(result);
    });
    return resultData;
}

const loadDir = async (absolutePath) => {
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

function checkFsErr(res, err, msg) {
    if (!err) {
        return true;
    }
    const jsonErr = { 
        error: msg,
        details: err.message 
    }
    console.error(msg, err)
    res.status(500).json(jsonErr);
    return false;
}

app.get('/api/files', async (req, res) => {
    try {
        const validator = new PathValidator(res, [req.query.path])
              .isAllowed();
        if(validator.isValid) {
            const result = await loadDir(validator.path)
            res.json(result);
        }
    } catch (error) {
        console.error('Ошибка при чтении директории:', error);
        res.status(500).json({ 
            error: 'Не удалось прочитать директорию',
            details: error.message 
        });
    }
});

app.get('/api/file', async (req, res) => {
    const validator = new PathValidator(res, [req.query.path])
        .isAllowed()
        .isJson()
        .then(absolutePath => {
            fs.readFile(absolutePath, 'utf-8', (err, content) => {
                if(!checkFsErr(res, err, `Ошибка чтения файла: ${absolutePath}`)) {
                    return;
                }
                // Валидация JSON
                try {
                    JSON.parse(content);
                } catch (error) {
                    const parseErr = { 
                        error: error instanceof SyntaxError ? `Невалидный JSON: ${content}` : errorMessageText,
                        details: error.message 
                    }
                    console.error(jsonErr)
                    return res.status(500).json(jsonErr);
                }
                //Всё ок!
                return res.type('application/json').send(content);
        });
    });
});

app.post('/api/file', express.json(), async (req, res) => {
    const validator = new PathValidator(res, [req.query.path])
    .isAllowed()
    .isJson()
    .then(absolutePath => {
        const absoluteDirPath = path.dirname(filePath);
        try {
            if (!fs.existsSync(absoluteDirPath)) {
                fs.mkdirSync(absoluteDirPath, { recursive: true } );
            }
        } catch (err) {
            if(!checkFsErr(res, err, `Ошибка создания папки: ${absolutePath}`)) {
              return;
            }
        }
        fs.writeFile(absolutePath, JSON.stringify(req.body, null, 2), (err) => {
            if(!checkFsErr(res, err, `Ошибка записи файла: ${absolutePath}`)) {
                return;
            }
            return res.json({ success: true });
        });
    })
});

app.post('/api/files', express.json(), async (req, res) => {
  const validator = new PathValidator(res, req.query.path)
      .isAllowed()
      .then(absolutePath => {
          const absoluteDirPath = path.dirname(filePath);
          try {
              if (!fs.existsSync(absoluteDirPath)) {
                  fs.mkdirSync(absoluteDirPath, { recursive: true } );
              }
          } catch (err) {
              if(!checkFsErr(res, err, `Ошибка создания папки: ${absolutePath}`)) {
                return;
              }
          }
      });
});

app.post('/api/file/rename', express.json(), async (req, res) => {
      const { pathOld, pathNew } = req.body;
      const isPathOldValid = new PathValidator(res, [pathOld])
              .isJson()
              .isValid();
      if(!isPathOldValid) {
          return;
      }

      const validator = new PathValidator(res, [pathOld, pathNew])
          .isAllowed()
          .then(absolutePaths => {
              const pathOld = absolutePaths[0];
              const pathNew = absolutePaths[1];
              // Выполняем переименование
              fs.rename(absolutePathOld, absolutePathNew, err => {
                  if(!checkFsErr(res, err, `Ошибка при переименовании ${absolutePathOld} в ${absolutePathNew}`)) {
                      return;
                  }
                  res.json({ 
                      success: true,
                      message: `Успешно переименовано ${absolutePathOld} в ${absolutePathNew}`,
                      pathOld,
                      pathNew
                  });
              });
          });
});

app.delete('/api/file', async (req, res) => {
    const validator = new PathValidator(res, [req.query.path])
                  .isAllowed()
                  .then(absolutePath => {
                      fs.stat(absolutePath, (err, stats) => {
                      if (err) {
                          console.error(`Ошибка удаления ${absolutePath}`, err);
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
                              if (!checkFsErr(res, err, messageErrText)) {
                                  return;
                              }
                              res.json(messageOK);
                          });
                      } else {
                          // Удаление файла
                          fs.unlink(absolutePath, err => {
                              if (!checkFsErr(res, err, messageErrText)) {
                                  return;
                              }
                            res.json(messageOK);
                          });
                      }
                });
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
