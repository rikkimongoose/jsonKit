const chokidar = require('chokidar');
const path = require('path');

class FileWatcherManager {
    constructor(config, fileHelper) {
        this.jsonDir = path.resolve(config.navigation.jsonDirectory);
        this.fileHelper = fileHelper;
        this.watchers = {};
        this.observers = [];
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    unsubscribe(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notifyAll(eventType, data) {
        this.observers.forEach(observer => observer.broadcast(eventType, data));
    }

    createDevWatcher() {
        const watcher = chokidar.watch(this.jsonDir, {
            ignored: /(^|[\/\\])\../,
            persistent: true
        });

        this.setupWatcherEvents(watcher);
        this.watchers.json = watcher;
        return watcher;
    }

    setupWatcherEvents(watcher, type) {
        const checkFile = filePath => filePath.endsWith('.json');
        const readExtData = filePath => this.fileHelper.loadExtData(config.navigation.extData, filePath);
        watcher
            .on('add', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                this.notifyAll(`file:add`, {
                    path: path.resolve(filePath),
                    basename: path.basename(filePath),
                    isDirectory: false,
                    extData: readExtData(filePath),
                    time: new Date().toISOString()
                });
            })
            .on('addDir', dirPath => {
                this.notifyAll(`file:addDir`, {
                    path: path.resolve(dirPath),
                    isDirectory: true,
                    time: new Date().toISOString()
                });
            })
            .on('change', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                this.notifyAll(`file:change`, {
                    path: path.resolve(filePath),
                    extData: readExtData(filePath),
                    isDirectory: false,
                    time: new Date().toISOString()
                });
            })
            .on('unlink', filePath => {
                if (!checkFile(filePath)) {
                    return;
                }
                this.notifyAll(`file:unlink`, {
                    path: path.resolve(filePath),
                    isDirectory: !path.extname(filePath),
                    time: new Date().toISOString()
                });
            })
            .on('unlinkDir', dirPath => {
                this.notifyAll(`file:unlinkDir`, {
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
    }

    startAll() {
        Object.values(this.watchers).forEach(watcher => watcher && watcher.add);
    }

    stopAll() {
        Object.values(this.watchers).forEach(watcher => watcher && watcher.close());
    }
}

module.exports = FileWatcherManager;