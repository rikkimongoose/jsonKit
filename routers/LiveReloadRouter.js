const path = require('path');
const chokidar = require('chokidar');

class LiveReloadRouter {
    constructor(config, emitter, httpHelper) {
        this.router = require('express').Router();
        this.emitter = emitter;
        this.url = "/sse";
        this.httpHelper = httpHelper;
        this.frontendDir = config.frontendDir;
        this.isDev = config.isDev;
        this.setupRoutes();
    }

    get pathUrl() {
        return this.url;
    }

    setupRoutes() {
        if (this.isDev) {
            this.router.get('/', this.getSse.bind(this));
        }
    }

    getSse(req, res) {
        this.httpHelper.makeLiveReload(res);
        
        const watcher = chokidar.watch(this.frontendDir, {
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
    }
}

module.exports = LiveReloadRouter;