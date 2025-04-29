const fs = require('fs-extra');
const path = require('path');

function loadTlsOptions(tlsOptions) {
    try {
        return tlsOptions ? {
            ...tlsOptions,
            key: fs.readFileSync(tlsOptions.key),
            cert: fs.readFileSync(tlsOptions.cert),
            ca: tlsOptions.ca.map(path => fs.readFileSync(path))
        } : null;
    } catch (error) {
        console.error('Ошибка загрузки TLS-конфигурации:', error.message);
        return null;
    }
}

class ConfigHelper {
    constructor(config, emitter) {
        this.source = config.source;
        this.validator = config.validator;
        this.configData = null;

        this.reloadConfig();
        this.emitter = emitter;
        this.emitter.on('config:changed', (e) => {
            this.emitter.emit('config:update', this.reloadConfig())
        });
    }

    reloadConfig() {
        require('dotenv').config();
        // Определение режима разработки
        this.isDev = process.env.NODE_ENV === 'development';

        this.rawConfig = fs.readFileSync(this.source, 'utf-8');
        this.parsedConfig = JSON.parse(this.rawConfig);
        this.configSchema = require(this.validator);
        if (this.isDev) {
            console.log('[DEV] Конфиг загружен.');
        }
        try {
            const { err, value } = this.configSchema.validate(this.parsedConfig, { abortEarly: false });
            if (err) {
                console.error('Ошибка в config.json:', err);
                error.details.forEach(err => console.error(`- ${err.message}`));
                process.exit(1);
            }
            this.configData = this.updateConfig(value);
        } catch (err) {
            console.error('Ошибка чтения config.json:', err.message);
            process.exit(1);
        }
        return this.configData;
    }

    updateConfig(config) {
        const configOriginal = {...config};
        if (process.env.MOCKFILES_DIR) {
            console.log(`Рабочая директория загружена из переменных окружения: ${process.env.MOCKFILES_DIR}`);
            configOriginal.navigation.jsonDirectory = process.env.MOCKFILES_DIR;
        }
        configOriginal.isDev = this.isDev;
        configOriginal.https = loadTlsOptions(configOriginal.https);
        configOriginal.navigation.jsonDirectoryFull = path.resolve(configOriginal.navigation.jsonDirectory);
        return configOriginal;
    }

    get config() {
        return this.configData;
    }
}

module.exports = ConfigHelper;