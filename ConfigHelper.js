import { readFileSync } from 'fs-extra';
const path = require('path');

class ConfigHelper {
    constructor(config) {
        this.source = config.source;
        this.validator = config.validator;
        this.configData = null;

        this.reloadConfig();
    }

    reloadConfig() {
        require('dotenv').config()
        // Определение режима разработки
        this.isDev = process.env.NODE_ENV === 'development';

        this.rawConfig = readFileSync(this.source, 'utf-8');
        this.parsedConfig = JSON.parse(rawConfig);
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
            this.configData = updateConfig({isDev, ...value});
        } catch (err) {
            console.error('Ошибка чтения config.json:', err.message);
            process.exit(1);
        }
        return this.configData;
    }

    updateConfig(config) {
        const configOriginal = {...config};
        configOriginal.navigation.jsonDirectoryFull = path.resolve(configOriginal.navigation.jsonDirectory);
        return configOriginal;
    }

    get config() {
        return this.configData;
    }
}

export default ConfigHelper;