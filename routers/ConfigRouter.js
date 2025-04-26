class ConfigRouter {
    constructor(config, appConst) {
        this.router = require('express').Router();
        this.url = "/config";
        this.configSource = config;
        this.appConst = appConst;
        this.setupRoutes();
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
        return this.configSource();
    }
    
    getData(req, res) {
        res.json({
            version: this.appConst.app.version,
            jsonDirectory: this.config.navigation.jsonDirectoryFull,
            server: this.config.server,
            wss: this.config.wss,
            extData: this.config.navigation.extData,
            extDataFilterSize: this.config.navigation.extDataFilterSize,
            isDev: this.config.isDev
        });
    }
}

module.exports = ConfigRouter;