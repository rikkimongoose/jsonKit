const express = require('express');
const path = require('path');

class HttpServer {
    constructor(config) {
        this.port = config.port;
        this.app = express();
        this.server = null;
        this.routers = [];
        this.isDev = config.isDev;
        this.frontendDir = config.frontendDir;
        this.modulesDir = config.modulesDir;
        
        this.setupMiddleware();
    }

    setupMiddleware() {
        const actuator = require('express-actuator');
        this.app.use(this.express.static(path.join(__dirname, this.frontendDir)));
        this.app.use(this.modulesDir, this.express.static(path.join(__dirname, 'node_modules')));
        this.app.use(actuator());
        if (this.isDev) {
            const morgan = require('morgan');
            this.app.use(morgan('dev')); 
        }
    }

    registerRouter(router) {
        this.routers.push(router);
        this.app.use(router.pathUrl, router.router);
    }

    start() {
        this.server = app.listen(this.port, () => {
            console.log(`Сервер запущен на http://localhost:${config.server.port}`);
            if (this.isDev) {
                console.log('[DEV] Режим разработки активен');
                console.log('[DEV] Отслеживаются изменения в:');
                console.log('  - server.js');
                console.log('  - config.json');
                console.log('  - public/');
            }
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = HttpServer;