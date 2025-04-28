class Application {
    constructor(config, httpServer, fileWatcherManager, webSocketServer) {
      this.config = config;
      this.httpServer = httpServer;
      this.fileWatcherManager = fileWatcherManager;
      this.webSocketServer = webSocketServer;
      this.isDev = config.isDev;
    }
    
    start() {
        this.httpServer.start({ ...this.config.server, http: this.config.http, https: this.config.https });
        this.webSocketServer.start({ ...this.config.websocket, http: this.config.http, https: this.config.https });
        this.fileWatcherManager.createWatchers();
    }
  
    stop() {
        // Грациозное завершение работы
        this.httpServer.stop();
        this.webSocketServer.stop();
        this.fileWatcherManager.stopAll();
    }
}

module.exports = Application;