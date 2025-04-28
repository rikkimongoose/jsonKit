const express = require('express');
const actuator = require('express-actuator');
const path = require('path');
const http = require('http');
const https = require('https');

class HttpServer {
    constructor(config, frontendConfig, emitter) {
        this.routers = [];
        this.isDev = config.isDev;
        this.frontendDir = frontendConfig.frontendDir;
        this.modulesDir = frontendConfig.modulesDir;

        this.emitter = emitter;
        emitter.on('config:update', (e) => {
            this.stop();
            this.start({ ...e.server, http: e.http, https: e.https });
        });
        this.server = null;
        this.serverHttps = null;
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
        const portHttps = config.portHttps || 443;
        const host = config.host || "localhost";
        const backlog = config.backlog || 511;

        const afterInitCallback = (protocol) => {
            return () => {
                console.log(`Сервер запущен на ${protocol}://${host}:${port}`);
                if (this.isDev) {
                    console.log('[DEV] Режим разработки активен');
                    console.log('[DEV] Отслеживаются изменения в:');
                    console.log('  - server.js');
                    console.log('  - config.json');
                    console.log('  - public/');
                }
            }
        };

        if(config.http) {
            this.server = https.createServer(config.http, this.express);
            this.server.listen(port, host, backlog, afterInitCallback("http"));
        } else {
            this.server = this.express.listen(port, host, backlog, afterInitCallback("http"));
        }

        if(config.https) {
            this.serverHttps = https.createServer(config.https, this.express);
            this.serverHttps.listen(portHttps, host, backlog, afterInitCallback("https"));
        }
    }

    stop() {
        [this.server, this.serverHttps].forEach(server => server && server.close());
    }
}

module.exports = HttpServer;