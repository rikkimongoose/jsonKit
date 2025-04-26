const WebSocket = require('ws');

class WebSocketServer {
    constructor(fileWatcherManager) {
        this.wss = null;
        this.clients = new Set();
        this.fileWatcherManager = fileWatcherManager;
        
        this.setupEventListeners();
    }
  
    setupEventListeners() {
        // Подписываемся на все файловые события
        this.fileWatcherManager.subscribe(this.handleFileEvent.bind(this));
    }
  
    handleFileEvent(type, data) {
        this.broadcast({
            type: type,
            timestamp: Date.now(),
            ...data
        });
    }
  
    start(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            this.clients.clear();
        }
    }
  
    broadcast(data) {
        const message = JSON.stringify({data});
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

module.exports = WebSocketServer;