const express = require('express');
const actuator = require('express-actuator');
const path = require('path');

class HttpServer {
    constructor(config, frontendConfig, emitter) {
        this.routers = [];
        this.isDev = config.isDev;
        this.frontendDir = frontendConfig.frontendDir;
        this.modulesDir = frontendConfig.modulesDir;

        this.emitter = emitter;
        emitter.on('config:update', (e) => {
            this.stop();
            this.start(e.server);
        });
        this.server = null;
        this.setupMiddleware();
    }

    setupMiddleware() {
        this.express = express();
        this.express.use(express.static(path.join(__dirname, (this.frontendDir))));
        this.express.use(this.modulesDir, express.static(path.join(__dirname, 'node_modules')));
        this.express.use(actuator());
        if (this.isDev) {
            const morgan = require('morgan');
            this.express.use(morgan('dev')); 
        }
    }

    registerRouter(router) {
        this.routers.push(router);
        this.express.use(router.pathUrl, router.router);
    }

    start(config) {
        const port = config.port || 3000;
        const host = config.host || "localhost";
        this.server = this.express.listen(port, host, () => {
            console.log(`Сервер запущен на http://${host}:${port}`);
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