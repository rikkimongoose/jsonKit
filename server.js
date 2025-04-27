const AppConstants = {
    app: {
        version: "1.0"
    },
    dirs: {
        config: {
            source: './config.json',
            validator: './config.schema.js'
        },
        frontendDir: '/public',
        modulesDir: '/modules'
    },
    ext: 'json'
};

const mitt = require('mitt');

const Application = require('./Application');
const ConfigHelper = require('./ConfigHelper');
const FileHelper = require('./FileHelper');
const HttpHelper = require('./HttpHelper');
const ApiRouter = require('./routers/ApiRouter');
const HealthcheckRouter = require('./routers/HealthcheckRouter');
const ConfigRouter = require('./routers/ConfigRouter');
const LiveReloadRouter = require('./routers/LiveReloadRouter');
const HttpServer = require('./HttpServer');
const WebSocketServer = require('./WebSocketServer');
const FileWatcherManager = require('./FileWatcherManager');

const emitter = mitt();
const configHelper = new ConfigHelper(AppConstants.dirs.config, emitter);
const fileHelper = new FileHelper({ext: AppConstants.ext});
const config = configHelper.config;

const apiRouter = new ApiRouter({
    jsonDirectory: config.navigation.jsonDirectory,
    ext: AppConstants.ext
}, emitter, fileHelper);
const healthcheckRouter = new HealthcheckRouter();
const configRouter = new ConfigRouter(config, AppConstants, emitter);
const httpHelper = new HttpHelper();
const liveReloadRouter = new LiveReloadRouter({
    frontendDir: AppConstants.dirs.frontendDir,
    isDev: config.isDev
}, emitter, httpHelper);
const routers = [apiRouter, healthcheckRouter, configRouter, liveReloadRouter];

const httpServer = new HttpServer(config, AppConstants.dirs, emitter);
routers.forEach(router => httpServer.registerRouter(router));

const fileWatcherManager = new FileWatcherManager({
    ext: AppConstants.ext,
    extData: config.navigation.extData,
    configSource: AppConstants.dirs.config.source,
    ...config.navigation
}, emitter, fileHelper);
const webSocketServer = new WebSocketServer(emitter);
const app = new Application(config, httpServer, fileWatcherManager, webSocketServer);

app.start();

// Грациозное завершение
process.on('SIGINT', () => {
    app.stop();
    process.exit();
});