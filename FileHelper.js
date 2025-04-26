import { forOwn, uniq } from 'lodash';
const path = require('path');
const jsonpath = require('jsonpath');

const ResultType = {
    FILE: 'file',
    DIRECTORY: 'directory'
};

class FileHelper {
    loadDir(absolutePath) {
        const items = fs.readDirSync(absolutePath, { withFileTypes: true });
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
            } else if (item.name.endsWith('.json')) {
                const extData = this.loadExtData(config.navigation.extData, localPath);
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
        result = resultDir.concat(resultFiles);
        return result;
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
        forOwn(extData, (jsonCmd, key) => {
            const result = jsonpath.query(jsonData, jsonCmd);
            resultData[key] = uniq(result);
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