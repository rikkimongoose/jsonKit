const WebSocket = require('ws');
const http = require('http');
const https = require('https');

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
            this.start({ ...e.websocket, http: e.http, https: e.https });
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
        if (config.http) {
            const server = http.createServer(config.http);
            this.ws = new WebSocket.Server({ ...config, server });
        } else {
            this.ws = new WebSocket.Server(config);
        }
        this.ws.on('connection', (ws) => {
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        if (config.https) {
            const server = https.createServer(config.https);
            const configHttps = {
                ...config,
                port: config.portHttps
            };
            this.wss = new WebSocket.Server({ ...configHttps, server });
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