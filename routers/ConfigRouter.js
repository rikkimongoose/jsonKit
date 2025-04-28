class ConfigRouter {
    constructor(config, appConstants, emitter) {
        this.router = require('express').Router();
        this.url = "/config";
        this.configSource = config;
        this.AppConstants = appConstants;
        this.emitter = emitter;
        this.setupRoutes();
        this.emitter.on('config:update', (e) => {
            this.configSource = e;
        });
    }

    get pathUrl() {
        return this.url;
    }
    
    setupRoutes() {
        this.router.get('/', this.getData.bind(this));
    }

    update(config) {
        this.configSource = config;
    }

    get config() {
        return this.configSource;
    }
    
    getData(req, res) {
        const wsConfig = { ...this.config.ws };
        wsConfig.tls = null;
        res.json({
            version: this.AppConstants.app.version,
            jsonDirectory: this.config.navigation.jsonDirectory,
            jsonDirectoryFull: this.config.navigation.jsonDirectoryFull,
            server: this.config.server,
            ws: wsConfig,
            wss: { port: (this.config.ws.tls ? this.config.ws.tls.port : this.config.ws.port) },
            extData: this.config.navigation.extData,
            extDataFilterSize: this.config.navigation.extDataFilterSize,
            isDev: this.config.isDev
        });
    }
}

module.exports = ConfigRouter;