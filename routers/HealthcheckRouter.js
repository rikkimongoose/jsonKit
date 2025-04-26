class HealthcheckRouter {
    constructor(config) {
        this.router = require('express').Router();
        this.url = "/healthcheck";
        this.setupRoutes();
    }

    get pathUrl() {
        return this.url;
    }

    setupRoutes() {
        this.router.get('/', this.getHealthcheck.bind(this));
    }

    getHealthcheck(req, res) {
        const healthcheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now()
        };
        try {
            res.send(healthcheck);
        } catch (error) {
            healthcheck.message = error;
            res.status(503).send();
        }
    }
}

module.exports = HealthcheckRouter;