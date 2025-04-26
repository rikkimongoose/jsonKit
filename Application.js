class Application {
    constructor(config) {
      this.config = config;
      this.httpServer = new HttpServer(this.config.http);
      this.fileWatcherManager = new FileWatcherManager();
      this.webSocketServer = new WebSocketServer(this.config.ws, this.fileWatcherManager);
      this.isDev = this.config.env === 'development';
      
      this.setupDependencies();
    }
    
    setupDependencies() {
      // Регистрируем обработчики событий
      this.fileWatcherManager.subscribe('file:user:change', (data) => {
        console.log('User file changed:', data.path);
        // Можно добавить дополнительную логику обработки
      });
      
      if (this.isDev) {
        this.devWatcher = this.fileWatcherManager.createDevWatcher();
      }
      
      this.userWatcher = this.fileWatcherManager.createUserWatcher(
            this.config.watchFolder
      );
    }
  
    start() {
        this.httpServer.start();
        this.webSocketServer.start(this.httpServer.server);
        this.fileWatcherManager.startAll();
    }
  
    stop() {
        // Грациозное завершение работы
        this.httpServer.stop();
        this.webSocketServer.stop();
        this.fileWatcherManager.stopAll();
    }
}

module.exports = Application;