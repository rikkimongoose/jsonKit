const AppConstants = {
    app: {
        version: "1.0"
    },
    files: {
        config: {
            source: './config',
            validator: 'config.schema'
        },
        frontend: './public',
        modulesDir: '/modules'
    },
    ext: 'json'
};

import Application from './Application';
import ConfigHelper from './ConfigHelper'
import ApiRouter from './routers/ApiRouter';
import HealthcheckRouter from './routers/HealthcheckRouter';
import ConfigRouter from './routers/ConfigRouter';
import LiveReloadRouter from './routers/LiveReloadRouter';
import HttpServer from './HttpServer'

const configHelper = ConfigHelper(AppConstants.files.config);
const config = configHelper.config;

const apiRouter = new ApiRouter({
    jsonDirectory: config.navigation.jsonDirectory,
    ext: AppConstants.ext
});
const healthcheckRouter = new HealthcheckRouter();
const configRouter = new ConfigRouter(config, AppConstants);
const liveReloadRouter = new LiveReloadRouter({
    frontend: AppConstants.files.frontend,
    isDev: config.isDev
});
const routers = [apiRouter, healthcheckRouter, configRouter, liveReloadRouter];

const app = new Application(config);
const httpServer = new HttpServer
routers.forEach(router => app.httpServer.registerRouter(router));

/*
app.start();

// Грациозное завершение
process.on('SIGINT', () => {
    app.stop();
    process.exit();
});*/