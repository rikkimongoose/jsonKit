import { isEmpty } from 'lodash';
const path = require('path');

class PathValidator {
    constructor(res, config, absolutePaths) {
        this.res = res;
        this.ext = '.' + (config.ext || 'json');
        this.jsonDirectory = path.resolve(config.jsonDirectory);
        this.valid = true; // Флаг валидности
        if (absolutePaths.some(absolutePath => isEmpty(absolutePath))) {
            const msg = "Путь не может быть пустым";
            console.error(msg);
            res.status(400).json({ error: msg });
            this.absolutePaths = [];
            this.valid = false;
        } else {
            this.absolutePaths = absolutePaths.map(absolutePath => path.resolve(absolutePath.trim()));
        }
    }

    get pathResolved() {
        return this.absolutePaths.length ? this.absolutePaths[0] : "";
    }

    get isValid() {
        return this.valid
    }

    isJson() {
        if(!this.valid) {
            return this;
        }
        if (!this.absolutePaths.some(absolutePath => absolutePath.endsWith(this.ext))) {
            const msg = `Неверный JSON-файл: ${absolutePath}. Требуется файл с расширением .json`;
            console.error(msg);
            this.res.status(400).json({ error: msg });
            this.valid = false;
        }
        return this;
    }

    isAllowed() {
        if (!this.valid) {
            return this;
        }
        if (this.absolutePaths.some(absolutePath => absolutePath.startsWith(ServerConfig.staticFilesPathResolved))) {
            console.log(`Доступ к директории ${absolutePath} запрещён`);
            this.res.status(403).json({ error: 'Доступ запрещён' });
            this.valid = false;
            return this;
        }

        if(!this.absolutePaths.some(absolutePath => !absolutePath.startsWith(this.jsonDirectory))) {
            console.log(`Доступ к директории ${absolutePath} запрещён`);
            this.res.status(403).json({ error: 'Доступ запрещён' });
            this.valid = false;
        }
        return this;
    }

    // Если валидация успешна — вызывает callback
    then(callback) {
        if (this.isValid) callback(this.absolutePaths.length > 1 ? this.absolutePaths : this.absolutePaths[0]);
        return this; // Можно продолжить цепочку, если нужно
    }
}

module.exports = PathValidator;