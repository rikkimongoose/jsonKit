const appState = {
    jsonFile: "",
    selectedPath: "",
    selectedDirectory: "",
    selectedFileName: "",
    selectedIsFolder: false,
    selectNode: function(node) {
        this.selectedPath = node.key;
        const separator = detectPathSeparator(this.selectedPath);
        const splitted = this.selectedPath.split(separator);
        if (node.folder) {
            this.selectedFileName = splitted[splitted.length - 1];
            this.selectedDirectory = this.selectedPath;
            this.selectedIsFolder = true;
        } else {
            this.selectedFileName = splitted.pop();
            this.selectedDirectory = splitted.join(separator);
            this.jsonFile = this.selectedPath;
            this.selectedIsFolder = false;
        }
    }
};

const GlobalCache = {
    _store: new Map(),
  
    _key(type, path) {
        return `${type}::${path}`;
    },
  
    add(obj) {
        if (!obj?.type || !obj?.path) {
            throw new Error('Object must have type and path');
        }
  
      this._store.set(this._key(obj.type, obj.path), obj);
    },
  
    hasAndRemove({ type, path }) {
      const key = this._key(type, path);
  
      if (this._store.has(key)) {
        this._store.delete(key);
        return true;
      }
  
      return false;
    },
  
    has({ type, path }) {
      const key = this._key(type, path);
      return this._store.has(key);
    },
  
    clear() {
      this._store.clear();
    }
}; 

const JsonEditorControl = {
    container: null,
    editor: null,
    openedFilePathDisplayElement: null,
    saveButton: null,
    filePath: null,
    init: function() {
        this.openedFilePathDisplayElement = document.getElementById('opened-file-path-display');
        this.container = document.getElementById('json-editor');
        const options = {
            mode: 'tree',
            modes: ['tree', 'code', 'form', 'text'],
            onError: (err) => {
              Logger.Error(err.message, "Ошибка JSONdata.pathEditor");
            }/*,
            onChange: () => {
              // Автосохранение при изменениях (опционально)
              saveCurrentFile();
            }*/
        };
        this.editor = new JSONEditor(this.container, options);
        this.editor.set({}); // Инициализация пустым объектом

        // Добавьте кнопку сохранения в HTML:
        this.saveButton = document.getElementById('save-btn');
        this.saveButton.addEventListener('click', () => this.saveCurrentFile());
    },
    loadJson: function(json, filePath) {
        if (!this.editor) {
            this.filePath = null;
            return;
        }
        this.openedFilePathDisplayElement.textContent = "loading...";
        this.editor.set(json);
        this.editor.expandAll();
        this.openedFilePathDisplayElement.textContent = filePath || "no file selected";
        this.filePath = filePath;
    },
    showFileContent: function(filePath) {
        fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                Logger.Error(error.message, `Ошибка: не удаётся открыть файл ${filePath}:`);
            })
            .then(json => {
                if (!this.editor) {
                    this.init();
                }
                this.loadJson(json, filePath);
            })
            .catch(error => {
                Logger.Error(error.message);
                if (this.editor) this.loadJson({ error: error.message });
            });
    },
    saveCurrentFile: function() {
        if (!appState.jsonFile) return;
        const jsonFile = appState.jsonFile;
        const json = this.editor.get();
        fetch(`/api/file?path=${encodeURIComponent(jsonFile)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json, null, 2)
        })
        .then(response => {
            if (response.ok) { 
                Logger.Success(`Файл ${jsonFile} успешно сохранён`);
                Logger.Debug(`Файл ${jsonFile} успешно сохранён`, response);
                return response.json();
            }
            throw new Error(`Ошибка: не удаётся сохранить файл ${jsonFile}:`); 
        })
        .catch(error => {
            Logger.Debug(error.message);
        });
    }
};

// Функция для обновления интерфейса
const UIControl = {
    appVersionElement: null,
    currentPathElement: null,
    init: function(config) {
        // Обновляем заголовок и путь
        this.appVersionElement = document.getElementById('app-version')
        this.currentPathElement = document.getElementById('current-path');
        this.appVersionElement.textContent = config.version;
        this.currentPathElement.textContent = config.jsonDirectory;
        
        // Добавляем индикатор разработки
        if (config.isDev) {
            document.body.classList.add('dev-mode');
            Logger.Info('[Frontend DEV] Режим разработки активирован');
        }  
    }
}

const sortMethod = (a, b) => {
  const x = (a.isFolder() ? "0" : "1") + a.title.toLowerCase(),
        y = (b.isFolder() ? "0" : "1") + b.title.toLowerCase();
  return x === y ? 0 : x > y ? 1 : -1;
};

const FileTreeControl = {
    fileTreeControl: null,
    refreshTreeControl: null,
    fancytreeControl: null,
    fancytree: null,
    treeFilter: null,
    init: function(config) {
        const filepath = config.jsonDirectory;
        const dataSourceRequest = `/api/files?path=${encodeURIComponent(filepath)}`;
        this.fileTreeControl = $("#file-tree");
        this.fancytreeControl = this.fileTreeControl.fancytree({
            extensions: ["filter", "dnd", "edit"],
            checkbox: false,
            selectMode: 1,
            source: {
                type: "GET",
                url: dataSourceRequest,
                dataType: "json",
                cache: false
            },
            lazyLoad: (event, data) => {
                data.result = new Promise((resolve) => {
                    fetch(`/api/files?path=${encodeURIComponent(data.node.data.key)}`)
                        .then(response => response.json())
                        .then(items => resolve(items));
                });
            },
            activate: (event, data) => {
                const node = data.node;
                if (!node.data) return;
                appState.selectNode(node);
                if (node.type === 'file') {
                    JsonEditorControl.showFileContent(appState.jsonFile);
                }
            },
            sort: sortMethod,
            dnd: {
                autoExpandMS: 400,
                focusOnClick: true,
                preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
                preventRecursiveMoves: true, // Prevent dropping nodes on own descendants
                dragStart: function(node, data) {
                /** This function MUST be defined to enable dragging for the tree.
                 *  Return false to cancel dragging of node.
                 */
                return true;
                },
                dragEnter: function(node, data) {
                    if ("directory" === node.type) {
                        return true;
                    }
                    return ["after"];
                },
                dragDrop: function(node, data) {
                    /** This function MUST be defined to enable dropping of items on
                     *  the tree.
                     */
                    data.otherNode.moveTo(node, data.hitMode);

                    const pathFileFrom = data.otherNode.key;
                    const separator = detectPathSeparator(pathFileFrom);
                    const splittedPathFileTo = node.key.split(separator);
                    if (!node.folder) {
                        splittedPathFileTo.pop();
                    }
                    const splittedPathFileFrom = pathFileFrom.split(separator);
                    const fromName = splittedPathFileFrom.pop();

                    splittedPathFileTo.push(fromName);
                    const pathFileTo = splittedPathFileTo.join(separator);

                    const moveRequest = generateMoveRequest(pathFileFrom, pathFileTo);
                    
                    [
                        ['add', pathFileTo],
                        ['unlink', pathFileFrom]
                    ].forEach(
                        ([type, path]) => GlobalCache.add({ type, path })
                    );
                    fetch(moveRequest.url, moveRequest.request)
                        .then(res => res.json())
                        .then(data => {
                            if (!data.success) {
                                console.error(data);
                                return;
                            }
                            const pathNew = data.pathNew;
                            node.key = pathNew;
                            if (!node.folder) {
                                document.getElementById('opened-file-path-display').textContent = pathNew;
                            }
                            appState.selectNode(node);
                        })
                        .catch(err => {
                            console.error(err);
                    });
                }
            },
            edit: {
                triggerStart: ["clickActive", "dblclick", "f2", "mac+enter", "shift+click"],
                beforeClose: function(event, data) {
                },
                beforeEdit: function(event, data){
                    // Return false to prevent edit mode
                },
                edit: function(event, data){
                // Editor was opened (available as data.input)
                },
                save: function(event, data){
                    // Simulate to start a slow ajax request...
                    const pathFileFrom = data.node.key;
                    const nameFileTo = data.input.val();

                    const separator = detectPathSeparator(pathFileFrom);
                    const splittedPath = pathFileFrom.split(separator);
                    splittedPath.pop();
                    const pathDirTo = splittedPath.join(separator);
                    splittedPath.push(nameFileTo);
                    const pathFileTo = splittedPath.join(separator);
                    const moveRequest = generateMoveRequest(pathFileFrom, pathFileTo);
                    const nodeElem = data.node;
                    
                    [
                        ['add', pathFileTo],
                        ['unlink', pathFileFrom]
                    ].forEach(
                        ([type, path]) => GlobalCache.add({ type, path })
                    );

                    fetch(moveRequest.url, moveRequest.request)
                        .then(res => res.json())
                        .then(data => {
                            if (!data.success) {
                                console.error(data);
                                return;
                            }
                            const pathNew = data.pathNew;
                            nodeElem.key = pathNew;
                            
                            appState.selectNode(nodeElem);
                            if(!nodeElem.folder) {
                                document.getElementById('opened-file-path-display').textContent = pathNew;
                            }
                            $(nodeElem.span).removeClass("pending");
                        })
                        .catch(err => {
                            console.error(err);
                        });
                    return true;
                },
                close: function(event, data){
                    // Editor was removed
                    if( data.save ) {
                        // Since we started an async request, mark the node as preliminary
                        $(data.node.span).addClass("pending");
                    }
                }
            }
        });
        this.fancytree = $.ui.fancytree.getTree(this.fancytreeControl);
        // Фильтрация дерева
        this.treeFilter = $("#tree-filter");
        this.treeFilter.on("keyup", function(e) {
            const filterStr = $(this).val();
            if (e && e.which === $.ui.keyCode.ESCAPE || filterStr.trim() === "") {
                $(this).val("");
                FileTreeControl.fancytree.clearFilter();
                return;
            }
            const filter = (node) => {
                // Приводим к нижнему регистру для нечувствительности к регистру
                var filterStrLower = filterStr.trim().toLowerCase();

                if (filterStrLower.length >= config.extDataFilterSize) {
                    var title = node.title ? node.title.trim().toLowerCase() : "";
                    if (title.includes(filterStrLower)) {
                        return true;
                    }

                    const comparatorFilter = ComparatorFactory.generateComparator(filterStrLower);
                    
                    if (comparatorFilter.matches(title)) {
                        return true;
                    }
                    if (node.data && node.data.extData) {
                        // Получаем дополнительное поле extData, если оно задано
                        return Object.values(node.data.extData).some((items) => items.some((item) => item.includes(filterStrLower) || comparatorFilter.matches(item)));          
                    }
                }
                return false;
            };
            
            FileTreeControl.fancytree.filterNodes(filter, {
                autoExpand: true
            });
        });
      
        // Кнопка обновления
        this.refreshTreeControl = $("#refresh-tree")
        this.refreshTreeControl.on("click", () => {
            FileTreeControl.fancytree.reload();
        });
    }
};

const FileTreeSocket = {
    socket: null,
    dataDir: null,
    wsUrl: null,
    init: function(config) {
        if (!config) {
            return;
        }
        const isHttps = window.location.protocol === 'https:';
        const wsProtocol = isHttps ? 'wss:' : 'ws:';
        const wsPort = isHttps ? config.websocket.portHttps : config.websocket.port;
        this.wsUrl = `${wsProtocol}//${config.server.host}:${wsPort}`;
        this.dataDir = config.jsonDirectoryFull;
        this.initSocket(this.wsUrl);
    },
    initSocket: function(wsUrl) {
        this.socket = new WebSocket(wsUrl);
        this.socket.onmessage = this.handleEvent.bind(this);
        this.socket.onclose = function() {
            Logger.Warning('WebSocket disconnected, reconnecting...');
            setTimeout(function() { FileTreeSocket.initSocket(FileTreeSocket.wsUrl) }, 1000);
        };
    },
    handleEvent: function(evt) {
      const data = JSON.parse(evt.data);
      const separator = detectPathSeparator(data.path);
      Logger.Debug('FS event:', data);
      
      const tree = FileTreeControl.fancytree;
      if (!tree) return;
    
      const pathHelper = {
        split: (path) => path.split(separator),
        join: (pathArr, len) => {
          if (len) {
            pathArr = pathArr.slice(0, len) 
          }
          return pathArr.join(separator);
        }
      };
      const dataDirSplitted = pathHelper.split(this.dataDir);
      const nodesHelper = {
        parsePathInfo: function (path) {
            const pathArr = pathHelper.split(path);
            const fileName = pathArr.pop();
            const pathDirJoined = pathHelper.join(pathArr);
            return {pathArr, fileName, pathDirJoined};
        },
        addFile: function(path, extData) {
            const pathInfo = this.parsePathInfo(path);
            let nodeDir = this.findNode(pathInfo.pathDirJoined) || this.addDirSplitted(pathInfo.pathArr);
            if (!nodeDir) {
                return null;
            }
            const fileNode = this.generateNode({
                basename: pathInfo.fileName,
                path: path,
                isDirectory: false,
                extData: extData
            });
            nodeDir.addChildren(fileNode);
            nodeDir.sortChildren(sortMethod, true);
            return this.findNode(path);
        },
        addDir: function(path) {
            const pathInfo = this.parsePathInfo(path);
            const parentNode = this.findNode(pathInfo.pathDirJoined);
            if(!parentNode) {
              return this.addDirSplitted([...pathInfo.pathArr, pathInfo.fileName]);
            }
            const nextNode = this.generateNode({
                basename: pathInfo.fileName,
                path: path,
                isDirectory: true
            });
            parentNode.addChildren(nextNode);
            parentNode.sortChildren(sortMethod, true);
            return nextNode;
        },
        addDirSplitted: function (pathSplitted) {
            let node = tree.getRootNode();
            let index = dataDirSplitted.length;
            let isEndReached = false; 
            while (index < pathSplitted.length) {
                const currentIndex = index;
                index++;
                const currentDir = pathHelper.join(pathSplitted, currentIndex + 1);
                if (!isEndReached) {
                    const newNode = this.findNode(currentDir);
                    if (newNode) {
                        node = newNode;
                        continue;
                    }
                    isEndReached = true;
                }
                const nextNode = this.generateNode({
                    basename: pathSplitted[currentIndex],
                    path: currentDir,
                    isDirectory: true
                });
                node.addChildren(nextNode);
                node.sortChildren(sortMethod, true);
                node = tree.getNodeByKey(currentDir);
            }
            return node;
        },
        remove: function (path) {
            // Удаляем узел
            const nodeToRemove = tree.getNodeByKey(path);
            if (nodeToRemove) {
                nodeToRemove.remove();
            }
            return null;
        },
        findNode: function (path) {return (this.dataDir === path) ? tree.getRootNode() : tree.getNodeByKey(path)},
        generateNode: function (data) { return (data.isDirectory) ? {
                title: data.basename,
                folder: true,
                key: data.path,
                type: 'directory'
            } : {
                title: data.basename,
                key: data.path,
                type: 'file',
                extData: data.extData
            }
          }
      };
      console.log(GlobalCache.has(data), data);
      if (GlobalCache.hasAndRemove(data)) {
            return;
      }

      switch(data.type) {
        case 'add':
            // Добавляем новый узел
            nodesHelper.addFile(data.path, data.extData);
            break;
        case 'addDir':
            // Добавляем новый узел
            nodesHelper.addDir(data.path);
            break;
        case 'unlink':
        case 'unlinkDir':
            nodesHelper.remove(data.path);
            break;
        case 'change':        
            // Обновляем файл (если он открыт в редакторе)
            if (appState.jsonFile === data.path) {
                JsonEditorControl.showFileContent(data.path);
            }
            const nodeToUpdate = tree.getNodeByKey(data.path);
            if (nodeToUpdate) {
              nodeToUpdate.data.extData = data.extData;
            }
            break;
      }
    },
};

// Инициализация SSE соединения для hot-reload
function initHotReload() {
    if (window.EventSource) {
        const eventSource = new EventSource('/sse');
        
        eventSource.onmessage = function(e) {
            if (e.data === 'reload') {
                Logger.Info('[Frontend DEV] Получен сигнал перезагрузки');
                window.location.reload();
            }
        };
        
        eventSource.onerror = function() {
            Logger.Warning('[Frontend DEV] SSE соединение закрыто');
            eventSource.close();
        };
    }
}

const DialogFactory = {
  create: (options) => {
    const prefix = options.prefix || "file";
    const validation = options.validation || null;
    const toFetchData = options.toFetchData;
    const isAvailable = options.isAvailable || null;

    const $dialogDiv = $(`#${prefix}-dialog`);

    const $form = $(`#${prefix}-dialog-form`);

    const initValues = () => {
        const inputValues = options.inputValues ? options.inputValues() : {};
        Object.entries(inputValues).forEach(([key, value]) => {
            const val = ('string' === typeof value) ? value : value();
            $(`#${prefix}-${key}`).val(val);
            $(`#${prefix}-${key}-static`).text(val);
        });
    };

    const loadValues = () => {
        var result = {};
        // Ищем все input внутри контейнера и перебираем их
        $dialogDiv.find('input').each(function() {
            var $input = $(this);
            var name = $input.attr('name');
            if (name) {
                result[name] = $input.val();
            }
        });
        return result;
    }

    const dialog = $dialogDiv.dialog({
        autoOpen: false, // Диалог не открывается автоматически
        modal: true,     // Блокирует взаимодействие с остальной страницей
        buttons: {
            "OK": function() {
                const inputValues = options.inputValues ? options.inputValues() : {};
                // Проверка валидации формы
                if (validation && !$form.valid()) {
                    return;
                }
                const values = loadValues();
                const fetchData = toFetchData({values, inputValues});
                // Выполняем fetch запрос
                fetch(fetchData.url, fetchData.request)
                    .then(function(response) {
                      if (!response.ok) {
                          throw new Error("Ошибка сети");
                      }
                      $dialogDiv.dialog("close");
                      return response.json();
                    })
                    .catch(function(error) {
                        Logger.Error(error.message, "Ошибка запроса");
                    });
            },
            "Cancel": function() {
                $(this).dialog("close");
            }
      },
      close: function() {
        // Сброс формы при закрытии диалога
        $dialogDiv.find('input').val('');
      }
    });
  
    if(validation && $form.length) {
        // Инициализация плагина валидации для формы
        $form.validate(validation);
    }

    // Открытие диалога по нажатию на кнопку
    const $btnOpenDialog = $(`#btn-${prefix}`); 
    $btnOpenDialog.on("click", function() {
        if(!isAvailable || isAvailable()) {
            initValues();
            dialog.dialog("open");
        }
    });
    return this;
  }
};

const DirectoryCreateDialog = {
  init: () => {
    const validation = {
      rules: {
        name: {
          required: true
        }
      },
      messages: {
        name: {
          required: "Пожалуйста, введите имя папки."
        }
      }
    };

    const dialogItem = DialogFactory.create({
      prefix: "directory",
      toFetchData: (data) => {
          console.log(data);
          const values = data.values || {};
          const separator = detectPathSeparator(values.path);
          const path = [appState.selectedDirectory, (values.path || "").trim()].join(separator);
          return {
            url: "/api/files",
            request: {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ path })
            }
          }
      },
      validation
    });
    return this;
  }
}

const FileCreateDialog = {
  init: () => {
    const validation = {
      rules: {
        name: {
          required: true
        }
      },
      messages: {
        name: {
          required: "Пожалуйста, введите имя файла."
        }
      }
    };
    const dialogItem = DialogFactory.create({
      prefix: "file",
      toFetchData: (data) => {
          const values = data.values || {}; 
          const separator = detectPathSeparator(values.path);
          const newFilePath = [appState.selectedDirectory, (values.path || "").trim()].join(separator);
          const path = newFilePath + (!newFilePath.endsWith(".json") ? ".json" : '');
          return {
              url: "/api/file",
              request: {
                  method: "POST",
                  headers: {
                      "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ path })
              }
          }
      },
      validation
    });
    return this;
  }
}

function detectPathSeparator(str) {
    return str.includes("\\") ? "\\" : "/";
}

const FileRenameDialog = {
  init: () => {
    const validation = {
      rules: {
        name: {
          required: true
        }
      },
      messages: {
        name: {
          required: "Пожалуйста, введите новое имя."
        }
      }
    };
    const dialogItem = DialogFactory.create({
        prefix: "file-rename",
        inputValues: () => { return { path: appState.selectedFileName } },
        toFetchData: (data) => {
            const values = data.values || {};
            const pathTrimmed = (values.path || "").trim();
            
            return prepareMoveRequest(pathTrimmed, appState.selectedPath, appState.selectedDirectory);
        },
        validation
    });
    return this;
  }
}

function prepareMoveRequest(fromName, from, to) {
    const separator = detectPathSeparator(to);
    const splitted = to.split(separator);
    if(appState.selectedIsFolder) {
        splitted[splitted.length - 1] = fromName;
    } else {
        splitted.push(fromName);
    }
    const newFilePath = splitted.join(separator);
    const path = newFilePath + (!(appState.selectedIsFolder || newFilePath.endsWith(".json")) ? ".json" : '');
    return generateMoveRequest(from, path);
}

function generateMoveRequest(pathOld, pathNew) {
    return {
        url: "/api/file-rename",
        request: {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ pathOld, pathNew })
        }
    };
}

const RemoveDialog = {
  init: () => {
    const dialogItem = DialogFactory.create({
      prefix: "file-delete",
      inputValues: () => { return { 
              fileName: appState.selectedFileName
          }
      },
      toFetchData: (data) => {
          const path = appState.selectedPath;
          return {
              url: `/api/file?path=${encodeURIComponent(path)}`,
              request: {
                  method: "DELETE"
              }
          }
      }
    });
    return this;
  }
}

const SliderControl = {
  init: function() {
    Split(['#left', '#right'], {
      sizes: [25, 75],     // начальное распределение ширины
      gutterSize: 10,      // ширина разделителя в пикселях
      minSize: 230,         // минимальная ширина каждого блока в пикселях
      cursor: 'col-resize' // вид курсора при наведении на разделитель
    });
  }
}

const DialogControl = {
    init: function() {
        [DirectoryCreateDialog,
          FileCreateDialog,
          FileRenameDialog,
          RemoveDialog].forEach(initDialog => initDialog.init());
    }
};

// Первоначальная загрузка
document.addEventListener('DOMContentLoaded', () => {
    // Получаем конфигурацию
    fetch('/config')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(config => {
            [UIControl, FileTreeControl, FileTreeSocket, DialogControl, SliderControl].forEach(control => control.init(config));
        })
        .catch(error => {
            Logger.Error(error.message, 'Ошибка загрузки конфигурации');
            UIControl.currentPathElement.textContent = 'Ошибка загрузки конфигурации';
        });

    // Инициализация hot-reload в режиме разработки
    if(['localhost', '127.0.0.1'].some((host) => window.location.hostname === host)) {
        initHotReload();
    }
});