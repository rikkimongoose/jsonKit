const chokidar = require('chokidar');
const path = require('path');

class FileWatcherManager {
    constructor(config, emitter, fileHelper) {
        this.jsonDirectory = config.jsonDirectory;
        this.ext = config.ext;
        this.configSource = config.configSource;
        this.extData = config.extData;
        this.fileHelper = fileHelper;
        this.emitter = emitter;
        this.watchers = {};
    }

    createWatchers() {
        this.watchers.config = this.createConfigWatcher();
        this.watchers.files = this.createFilesWatcher();
    }

    createConfigWatcher() {
        // Отслеживание изменений конфига
        const configWatcher = chokidar.watch(this.configSource, {
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });
        configWatcher.on('change', () => {
            console.log('\n[DEV] Обнаружено изменение конфига');
            const oldPort = config.server.port;
            const oldLocation = config.server.location;
            config = loadConfig();
          
            if (oldPort !== config.server.port) {
                console.log('[DEV] Порт изменился. Требуется перезапуск сервера.');
            } else if (oldLocation !== config.server.location) {
                console.log('[DEV] Расположение изменилось. Требуется перезапуск сервера.');
            }
            this.emitter.emit('config:changed', config);
          })
          .on('ready', () => {
              console.log(`Предварительное сканирование завершено. Отслеживаются изменения в: ${this.configSource}`);
          });
        return configWatcher;
    } 

    createFilesWatcher() {
        const watcher = chokidar.watch(this.jsonDirectory, {
            ignored: /(^|[\/\\])\../,
            persistent: true
        });

        this.setupFilesWatcherEvents(watcher);
        return watcher;
    }

    setupFilesWatcherEvents(watcher) {
        const notify = (type, data) => 
            this.emitter.emit('files:change', {type, ...data });

        const checkFile = filePath => filePath.endsWith(this.ext);
        const readExtData = filePath => this.fileHelper.loadExtData(this.extData, filePath);
        watcher
            .on('add', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                notify(`add`, {
                    path: path.resolve(filePath),
                    basename: path.basename(filePath),
                    isDirectory: false,
                    extData: readExtData(filePath)
                });
            })
            .on('addDir', dirPath => {
                notify(`addDir`, {
                    path: path.resolve(dirPath),
                    isDirectory: true
                });
            })
            .on('change', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                notify(`change`, {
                    path: path.resolve(filePath),
                    extData: readExtData(filePath),
                    isDirectory: false
                });
            })
            .on('unlink', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                notify(`unlink`, {
                    path: path.resolve(filePath),
                    isDirectory: !path.extname(filePath)
                });
            })
            .on('unlinkDir', dirPath => {
                notify(`unlinkDir`, {
                    path: path.resolve(dirPath),
                    isDirectory: true
                });
            })
            .on('error', error => {
                console.error('Watcher error:', error);
            })
            .on('ready', () => {
                console.log(`Предварительное сканирование завершено. Отслеживаются изменения в: ${this.jsonDirectory}`);
            });
    }

    stopAll() {
        Object.entries(this.watchers).forEach(([title, watcher]) => watcher.close()
            .then(() => console.log(`Watcher ${title} остановлен`))
            .catch(err => console.error(`Ошибка при остановке ${title}:`, err))
        );
    }
}

module.exports = FileWatcherManager;