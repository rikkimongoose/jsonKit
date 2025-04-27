const path = require('path');
const jsonpath = require('jsonpath');
const fs = require('fs-extra');

const ResultType = {
    FILE: 'file',
    DIRECTORY: 'directory'
};

class FileHelper {
    constructor(config) {
        this.ext = '.' + (config.ext || 'json');
        this.extData = config.extData;
    }

    loadDir(absolutePath) {
        const items = fs.readdirSync(absolutePath, { withFileTypes: true });
        const resultDir = [];
        const resultFiles = [];
        items.forEach(item => {
            const localDirPath = path.resolve(item.parentPath);
            const localPath = path.join(localDirPath, item.name);
            if (item.isDirectory()) {
                const subDir = loadDir(localPath);
                // Добавляем директорию
                resultDir.push({
                    title: item.name,
                    folder: true,
                    key: localPath,
                    type: ResultType.DIRECTORY,
                    children: subDir,
                    extData: {}
                });
            } else if (item.name.endsWith(this.ext)) {
                const extData = this.loadExtData(this.extData, localPath);
                // Добавляем только JSON-файлы
                resultFiles.push({
                    title: item.name,
                    key: localPath,
                    type: ResultType.FILE,
                    extData: extData
                });
            }
        });
    
        // Сортируем: сначала директории, потом файлы
        const sortByName = (a, b) => a.title.localeCompare(b.title);
        resultDir.sort(sortByName);
        resultFiles.sort(sortByName);
        return resultDir.concat(resultFiles);
    }

    loadExtData(extData, localPath) {
        if(!extData) {
            return null;
        }
        const jsonSource = this.readFile(localPath);
        if(!jsonSource) {
            return null;
        }
        const jsonData = this.parseJson(jsonSource);
        if(!jsonData) {
            return null;
        }
    
        const resultData = {};
        // Перебор всех собственных свойств объекта
        Object.entries(extData).forEach(([key, jsonCmd]) => {
            const result = jsonpath.query(jsonData, jsonCmd);
            resultData[key] = [...new Set(result)];
        });
        return resultData;
    }
    
    readFile(localPath) {
        try {
            // Пытаемся загрузить данные из файла
            return fs.readFileSync(localPath, 'utf-8');
        } catch (error) {
            // В случае ошибки выводим её в console.error
            console.error(`Ошибка при чтении файла: ${error.message}`);
            return null; // Возвращаем null, если произошла ошибка
        }
    }

    parseJson(jsonSource) {
        try {
            return JSON.parse(jsonSource);
        } catch (error) {
            console.error(`Ошибка при разборе JSON: ${error.message}`);
            return null;
        }
    }
}

module.exports = FileHelper;