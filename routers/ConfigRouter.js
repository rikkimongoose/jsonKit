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
        res.json({
            version: this.AppConstants.app.version,
            jsonDirectory: this.config.navigation.jsonDirectory,
            server: this.config.server,
            wss: this.config.wss,
            extData: this.config.navigation.extData,
            extDataFilterSize: this.config.navigation.extDataFilterSize,
            isDev: this.config.isDev
        });
    }
}

module.exports = ConfigRouter;