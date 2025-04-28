class Application {
    constructor(config, httpServer, fileWatcherManager, webSocketServer) {
      this.config = config;
      this.httpServer = httpServer;
      this.fileWatcherManager = fileWatcherManager;
      this.webSocketServer = webSocketServer;
      this.isDev = config.isDev;
    }
    
    start() {
        this.httpServer.start(this.config.server);
        this.webSocketServer.start(this.config.ws);
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