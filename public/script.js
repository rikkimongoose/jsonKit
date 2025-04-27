let fileTreeSocket;

const appState = {
  currentJsonFile: "",
  $treeNode: null
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
        if (!appState.currentJsonFile) return;
        const currentJsonFile = appState.currentJsonFile;
        const json = this.editor.get();
        fetch(`/api/file?path=${encodeURIComponent(currentJsonFile)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json, null, 2)
        })
        .then(response => {
            if (response.ok) { 
                Logger.Success(`Файл ${currentJsonFile} успешно сохранён`);
                Logger.Debug(`Файл ${currentJsonFile} успешно сохранён`, response);
                return response.json();
            }
            throw new Error(`Ошибка: не удаётся сохранить файл ${currentJsonFile}:`); 
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

function initFileTree(config) {
    const filepath = config.jsonDirectory;
    const dataSourceRequest = `/api/files?path=${encodeURIComponent(filepath)}`
    $("#file-tree").fancytree({
      extensions: ["filter"],
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
        if (node.type === 'file') {
            appState.currentJsonFile = node.key;
            JsonEditorControl.showFileContent(appState.currentJsonFile);
        }
      },
      sort: function(a, b) {
        if (a.data.isFolder && !b.data.isFolder) return -1;
        if (!a.data.isFolder && b.data.isFolder) return 1;
        return a.title.localeCompare(b.title);
      }
    });
  
    // Фильтрация дерева
    $("#tree-filter").on("keyup", function(e) {
      const filterStr = $(this).val();
      if (e && e.which === $.ui.keyCode.ESCAPE || filterStr.trim() === "") {
          $(this).val("");
          $("#file-tree").fancytree("getTree").clearFilter();
          return;
      }

      const filter = (node) => {
          // Приводим к нижнему регистру для нечувствительности к регистру
          var title = node.title ? node.title.trim().toLowerCase() : "";
          var filterStrLower = filterStr.trim().toLowerCase();
          const comparatorFilter = ComparatorFactory.generateComparator(filterStrLower);

          if (comparatorFilter.matches(title)) {
            return true;
          }
          if (filterStrLower.length > config.extDataFilterSize && node.data && node.data.extData) {
            // Получаем дополнительное поле extData, если оно задано
            return Object.values(node.data.extData).some((items) => items.some((item) => comparatorFilter.matches(item)));          
          }
          return false;
      };
      
      $("#file-tree").fancytree("getTree").filterNodes(filter, {
        autoExpand: true
      });
    });
  
    // Кнопка обновления
    $("#refresh-tree").on("click", () => {
      const tree = $("#file-tree").fancytree("getTree");
      tree.reload();
    });
  }

const FileTreeSocket = {
    socket: null,
    dataDir: null,
    wsUrl: null,
    init: function(config) {
        if (!config) {
            return;
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.wsUrl = `${wsProtocol}//${config.server.location}:${config.wss.port}`;
        this.dataDir = config.jsonDirectoryFull;
        this.initSocket(this.wsUrl);
    },
    initSocket: function(wsUrl) {
        this.socket = new WebSocket(wsUrl);
        this.socket.onmessage = this.handleEvent.bind(this);
        this.socket.onclose = function() {
            Logger.Warning('WebSocket disconnected, reconnecting...');
            setTimeout(function() { this.initSocket(this.wsUrl) }, 1000);
        };
    },
    handleEvent: function(event) {
      const data = JSON.parse(event.data);
      Logger.Debug('FS event:', data);
      
      const tree = $("#file-tree").fancytree("getTree");
      if (!tree) return;
    
      const pathHelper = {
        split: (path) => path.split('/'),
        join: (pathArr, len) => {
          if (len) {
            pathArr = pathArr.slice(0, len) 
          }
          return pathArr.join('/');
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
          return this.findNode(pathInfo.pathDirJoined) || this.addDirSplitted([...pathInfo.pathArr, pathInfo.fileName]);
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
              type: 'file'
            }
          },
      };
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
          if (appState.currentJsonFile === data.path) {
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

const sortMethod = (a, b) => {
  const x = (a.isFolder() ? "0" : "1") + a.title.toLowerCase(),
        y = (b.isFolder() ? "0" : "1") + b.title.toLowerCase();
  return x === y ? 0 : x > y ? 1 : -1;
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
    const inputStatic = options.inputStatic || {};
    const inputValues = options.inputValues || {};
    const toFetchData = options.toFetchData;
    const isAvailable = options.isAvailable || null;

    const $dialogDiv = $(`#${prefix}-dialog`);

    const $form = $(`#${prefix}-dialog-form`);

    const initStatic = () => {
        Object.entries(inputStatic).forEach(([key, value]) => $dialogDiv.find(`#${key}`).val(value()));
    };

    const initValues = () => {
        Object.entries(inputValues).forEach(([key, value]) => $form.find(`#${prefix}-${key}`).val(value()));
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
          // Проверка валидации формы
          if (!validation || $form.valid()) {
            const values = loadValues();
            const fetchData = toFetchData({values, inputValues, inputStatic});
            // Выполняем fetch запрос
            fetch(fetchData.url, fetchData.request)
            .then(function(response) {
              if (!response.ok) {
                throw new Error("Ошибка сети");
              }
              return response.json();
            })
            .then(function(data) {
              // Если запрос успешен, закрываем диалог
              dialog.dialog("close");
            })
            .catch(function(error) {
              Logger.Error(error.message, "Ошибка запроса");
            });
          }
        },
        "Cancel": function() {
          $(this).dialog("close");
        }
      },
      close: function() {
        // Сброс формы при закрытии диалога
        $form.reset();
        $form.validate().resetForm();
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
        initStatic();
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
          const values = data.values || {};
          const path = (values.path || "").trim();
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
          const path = (values.path || "").trim();
          return {
            url: "/api/files",
            request: {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ pathOld: "", pathNew: path })
            }
          }
      },
      validation
    });
    return this;
  }
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
      toFetchData: (data) => {
          const values = data.values || {};
          const path = (values.path || "").trim();
          return {
            url: "/api/files",
            request: {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ pathOld: "", pathNew: path })
            }
          }
      },
    });
    return this;
  }
}

const RemoveDialog = {
  init: () => {
    const dialogItem = DialogFactory.create({
      prefix: "file-delete",
      toFetchData: (data) => {
        return {
          url: `/api/files?path=${encodeURIComponent(path)}`,
          request: {
            method: "DELETE"
          }
        }
      },
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
            initFileTree(config);
            [UIControl, FileTreeSocket, DialogControl, SliderControl].forEach(control => control.init(config));
        })
        .catch(error => {
            Logger.Error(error.message, 'Ошибка загрузки конфигурации');
            currentPathElement.textContent = 'Ошибка загрузки конфигурации';
        });

    // Инициализация hot-reload в режиме разработки
    if(['localhost', '127.0.0.1'].some((host) => window.location.hostname === host)) {
        initHotReload();
    }
});