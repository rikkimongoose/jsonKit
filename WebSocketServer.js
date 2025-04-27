const WebSocket = require('ws');

class WebSocketServer {
    constructor(emitter) {
        this.wss = null;
        this.clients = new Set();
        this.emitter = emitter;

        emitter.on('config:update', (e) => {
            this.stop();
            this.start(e.wss);
        });
        emitter.on('files:change', (e) => {
            this.handleFileEvent(e);
        });
    }
  
    handleFileEvent(data) {
        this.broadcast({
            timestamp: Date.now(),
            ...data
        });
    }
  
    start(config) {
        this.wss = new WebSocket.Server(config);

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