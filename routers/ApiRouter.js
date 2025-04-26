const path = require('path');
const PathValidator = require("./PathValidator");

class ApiRouter {
    constructor(config, fileHelper) {
        this.router = require('express').Router();
        this.jsonDirectory = config.jsonDirectory;
        this.ext = config.ext;
        this.url = "/api";
        this.fileHelper = fileHelper;
        this.setupRoutes();
    }

    get pathUrl() {
        return this.url;
    }

    update(config) {
        this.config = config;
        this.jsonDir = config.navigation.jsonDir;
    }

    setupRoutes() {
        this.router.get('/file', express.json(), this.createFile.bind(this));
        this.router.get('/files', express.json(), this.createDirectory.bind(this));
        this.router.post('/file', express.json(), this.createFile.bind(this));
        this.router.post('/files', express.json(), this.createDirectory.bind(this));
        this.router.post('/file-rename', express.json(), this.renameFile.bind(this));
        this.router.delete('/file', this.deleteFile.bind(this));
    }

    generateValidatorConfig() {
        return {
            jsonDirectory: config.jsonDirectory,
            ext: config.ext
        };
    }

    getFile(req, res) {
        try {
            const validator = new this.PathValidator(res, generateValidatorConfig(), [req.query.path])
                .isAllowed()
                .then(absolutePath => res.json(this.fileHelper.loadDir(absolutePath)) );
        } catch (error) {
            console.error('Ошибка при чтении директории:', error);
            res.status(500).json({ 
                error: 'Не удалось прочитать директорию',
                details: error.message 
            });
        }
    }

    getDirectory(req, res) {
        const validator = new this.PathValidator(res, generateValidatorConfig(), [req.query.path])
            .isAllowed()
            .isJson()
            .then(absolutePath => {
                fs.readFile(absolutePath, 'utf-8', (err, content) => {
                    if(!checkFsErr(res, err, `Ошибка чтения файла: ${absolutePath}`)) {
                        return;
                    }
                    // Валидация JSON
                    try {
                        JSON.parse(content);
                    } catch (error) {
                        const parseErr = { 
                            error: error instanceof SyntaxError ? `Невалидный JSON: ${content}` : errorMessageText,
                            details: error.message 
                        }
                        console.error(jsonErr)
                        return res.status(500).json(jsonErr);
                    }
                    //Всё ок!
                    return res.type('application/json').send(content);
            });
        });
    }
    
    createFile(req, res) {
        const validator = new PathValidator(res, generateValidatorConfig(), [req.query.path])
            .isAllowed()
            .isJson()
            .then(absolutePath => {
                const absoluteDirPath = path.dirname(filePath);
                try {
                    if (!fs.existsSync(absoluteDirPath)) {
                        fs.mkdirSync(absoluteDirPath, { recursive: true } );
                    }
                } catch (err) {
                    if(!checkFsErr(res, err, `Ошибка создания папки: ${absolutePath}`)) {
                    return;
                    }
                }
                fs.writeFile(absolutePath, JSON.stringify(req.body, null, 2), (err) => {
                    if(!checkFsErr(res, err, `Ошибка записи файла: ${absolutePath}`)) {
                        return;
                    }
                    return res.json({ success: true });
                });
            });
    }
    
    createDirectory(req, res) {
        const validator = new PathValidator(res, generateValidatorConfig(), req.query.path)
            .isAllowed()
            .then(absolutePath => {
                const absoluteDirPath = path.dirname(filePath);
                try {
                    if (!fs.existsSync(absoluteDirPath)) {
                        fs.mkdirSync(absoluteDirPath, { recursive: true } );
                    }
                } catch (err) {
                    if(!checkFsErr(res, err, `Ошибка создания папки: ${absolutePath}`)) {
                    return;
                    }
                }
            });
    }
    
    renameFile(req, res) {
        const { pathOld, pathNew } = req.body;
        const isPathOldValid = new PathValidator(res, generateValidatorConfig(), [pathOld])
                .isJson()
                .isValid();
        if(!isPathOldValid) {
            return;
        }
  
        const validator = new PathValidator(res, generateValidatorConfig(), [pathOld, pathNew])
            .isAllowed()
            .then(absolutePaths => {
                const pathOld = absolutePaths[0];
                const pathNew = absolutePaths[1];
                // Выполняем переименование
                fs.rename(absolutePathOld, absolutePathNew, err => {
                    if(!checkFsErr(res, err, `Ошибка при переименовании ${absolutePathOld} в ${absolutePathNew}`)) {
                        return;
                    }
                    res.json({ 
                        success: true,
                        message: `Успешно переименовано ${absolutePathOld} в ${absolutePathNew}`,
                        pathOld,
                        pathNew
                    });
                });
            });
    }

    deleteFile(req, res) {
        const validator = new PathValidator(res, generateValidatorConfig(), [req.query.path])
            .isAllowed()
            .then(absolutePath => {
                fs.stat(absolutePath, (err, stats) => {
                    if (err) {
                        console.error(`Ошибка удаления ${absolutePath}`, err);
                        if (err.code === 'ENOENT') {
                            res.status(404).json({ error: 'Файл или директория не найдены' });
                        } else {
                            res.status(500).json({ 
                                error: 'Ошибка при удалении',
                                details: err.message 
                            });
                        }
                    }
                    const messageOK = { success: true, message: `Удаление ${requestedPath} успешно` }
                    const messageErrText = `Ошибка при удалении ${requestedPath}`
                    if (stats.isDirectory()) {
                        // Удаление директории
                        fs.rm(absolutePath, { recursive: true, force: true }, err => {
                            if (!checkFsErr(res, err, messageErrText)) {
                                return;
                            }
                            res.json(messageOK);
                        });
                    } else {
                        // Удаление файла
                        fs.unlink(absolutePath, err => {
                            if (!checkFsErr(res, err, messageErrText)) {
                                return;
                            }
                        res.json(messageOK);
                        });
                    }
                });
            });
    }
}

module.exports = ApiRouter;