const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

class WebSocketServer {
    constructor(emitter) {
        this.ws = null;
        this.wss = null;
        this.httpsServer = null;
        this.clients = new Set();
        this.clientsHttps = new Set();
        this.emitter = emitter;

        emitter.on('config:update', (e) => {
            this.stop();
            this.start(e.ws);
        });
        emitter.on('files:change', (e) => {
            this.handleFileEvent(e);
        });
    }
  
    handleFileEvent(data) {
        this.broadcast({
            timestamp: new Date().toISOString(),
            ...data
        });
    }
  
    start(config) {
        this.ws = new WebSocket.Server(config);

        this.ws.on('connection', (ws) => {
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        if(config.tls) {
            const configTls = { ...config.tls };
            configTls.key = fs.readFileSync(configTls.key);
            configTls.cert = fs.readFileSync(configTls.cert);
            if (configTls.ca) {
                configTls.ca = configTls.ca.map(fileName => fs.readFileSync(fileName));
            }

            const server = https.createServer(options);
            this.wss = new WebSocket.Server({ server });
            this.wss.on('connection', (wss) => {
                this.clients.add(wss);
                
                wss.on('close', () => {
                    this.clients.delete(wss);
                });
            });
        }
    }

    stop() {
        if (this.ws) {
            this.ws.close();
            this.clients.clear();
        }
        if (this.wss) {
            this.wss.close();
            this.clientsHttps.clear();
        }
    }
  
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
        this.clientsHttps.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

module.exports = WebSocketServer;