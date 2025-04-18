// DOM элементы
const appTitleElement = document.getElementById('app-title');
const appVersion = document.getElementById('app-version')
const currentPathElement = document.getElementById('current-path');
const leftPanelElement = document.getElementById('left-panel');
const rightPanelElement = document.getElementById('right-panel');
const openedFilePathDisplayElement = document.getElementById('opened-file-path-display');

let editor;
let currentFilePath = "";
let fileTreeSocket;

function initJSONEditor() {
  const container = document.getElementById('json-editor');
  const options = {
    mode: 'tree',
    modes: ['tree', 'code', 'form', 'text'],
    onError: (err) => {
      console.error('JSONdata.pathEditor error:', err);
    }/*,
    onChange: () => {
      // Автосохранение при изменениях (опционально)
      saveCurrentFile();
    }*/
  };
  
  editor = new JSONEditor(container, options);
  editor.set({}); // Инициализация пустым объектом
}

function saveCurrentFile() {
    if (!currentFilePath) return;
    const json = editor.get();
    fetch(`/api/file?path=${encodeURIComponent(currentFilePath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json, null, 2)
      })
      .then(response => {
            if (response.ok) {
                console.log(`Файл ${currentFilePath} успешно сохранён`, response)
                return response.json()
            }
            throw new Error(`Ошибка: не удаётся сохранить файл ${currentFilePath}:`); 
        })
      .catch(error => {
          console.error(error);
      });
}

// Добавьте кнопку сохранения в HTML:
document.getElementById('save-btn').addEventListener('click', saveCurrentFile);

// Модифицируем функцию showFileContent
function showFileContent(filePath) {
    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            console.error(`Ошибка: не удаётся открыть файл ${filePath}:`, error);
        })
        .then(json => {
            if (!editor) {
                initJSONEditor();
            }
            openedFilePathDisplayElement.textContent = filePath;
            editor.set(json);
            editor.expandAll();
        })
        .catch(error => {
            console.error(error);
            if (editor) editor.set({ error: error.message });
        });
}

// Функция для обновления интерфейса
function updateUI(config) {
    // Обновляем заголовок и путь
    appTitleElement.textContent = config.title;
    appVersion.textContent = config.version;
    currentPathElement.textContent = config.filepath;
    
    // Добавляем индикатор разработки
    if (config.isDev) {
        document.body.classList.add('dev-mode');
        console.log('[Frontend DEV] Режим разработки активен');
    }  
}

function initFileTree(filepath) {
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
            currentFilePath = node.key;
            showFileContent(currentFilePath);
        }
      }
    });
  
    // Фильтрация дерева
    $("#tree-filter").on("keyup", function(e) {
      const filter = $(this).val();
      if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(filter) === "") {
        $(this).val("");
        $("#file-tree").fancytree("getTree").clearFilter();
        return;
      }
      
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
  
  function initWebSocket(config) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:${config.portWss}`;
    
    const fileTreeSocket = new WebSocket(wsUrl);
    const dataDir = config.filepathFull;

    fileTreeSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('FS event:', data);
      
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
      const dataDirSplitted = pathHelper.split(dataDir);

      const nodesHelper = {
        parsePathInfo: (path) => {
          const pathArr = pathHelper.split(path);
          const fileName = pathArr.pop();
          const pathDirJoined = pathHelper.join(pathArr);
          return {pathArr, fileName, pathDirJoined};
        },
        addFile: (path) => {
          const pathInfo = this.parsePathInfo(path);
          let nodeDir = this.findNode(pathInfo.pathDirJoined) || this.addDirSplitted(pathInfo.pathArr);
          if (!nodeDir) {
              return null;
          }
          const fileNode = generateNode({
            basename: pathInfo.fileName,
            path: path,
            isDirectory: false
          });
          nodeDir.addChildren(fileNode);
          return this.findNode(path);
        },
        addDir: (path) => {
          const pathInfo = this.parsePathInfo(path);
          return this.findNode(pathInfo.pathDirJoined) || this.addDirSplitted([...pathArr, pathInfo]);
        },
        addDirSplitted: (pathSplitted) => {
          let node = tree.getRootNode();
          let index = dataDirSplitted.length;
          let isEndReached = false; 
          while (index < pathSplitted.length) {
            const currentIndex = index;
            index++;

            const currentDir = pathHelper.join(pathSplitted, currentIndex);
            if (!isEndReached) {
              const newNode = this.findNode(currentDir);
              if (newNode) {
                node = newNode;
                continue;
              }
              isEndReached = true;
            }
            const nextNode = generateNode({
              basename: pathSplitted[currentIndex],
              path: currentDir,
              isDirectory: false
            });
            node.addChildren(nextNode);
            node = tree.getNodeByKey(currentDir);
          }
          return node;
        },
        remove: (path) => {
          // Удаляем узел
          const nodeToRemove = tree.getNodeByKey(path);
          if (nodeToRemove) {
            nodeToRemove.remove();
          }
          return null;
        },
        findNode: (path) => (dataDir === path) ? tree.getRootNode() : tree.getNodeByKey(path),
        generateNode: (data) => (data.isDirectory) ? {
              title: data.basename,
              folder: true,
              key: data.path,
              type: 'directory',
              children: subDir
            } : {
              title: data.basename,
              key: data.path,
              type: 'file'
            },
      };

      switch(data.type) {
        case 'add':
          // Добавляем новый узел
          nodesHelper.addFile(data.path);
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
          if (currentFilePath === data.path) {
            showFileContent(data.path);
          }
          break;
      }
    };

    fileTreeSocket.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(initWebSocket, 1000);
    };
  }

// Инициализация SSE соединения для hot-reload
function initHotReload() {
    if (window.EventSource) {
        const eventSource = new EventSource('/sse');
        
        eventSource.onmessage = function(e) {
            if (e.data === 'reload') {
                console.log('[Frontend DEV] Получен сигнал перезагрузки');
                window.location.reload();
            }
        };
        
        eventSource.onerror = function() {
            console.log('[Frontend DEV] SSE соединение закрыто');
            eventSource.close();
        };
    }
}

// Первоначальная загрузка
document.addEventListener('DOMContentLoaded', () => {
    // Получаем конфигурацию
    fetch('/config')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(config => {
          document.getElementById('app-title').textContent = config.title;
          document.getElementById('current-path').textContent = config.filepath;
          initFileTree(config.filepath);
          initWebSocket(config);
          updateUI(config)
        })
        .catch(error => {
            console.error('Ошибка загрузки конфигурации:', error);
            currentPathElement.textContent = 'Ошибка загрузки конфигурации';
        });
    
    // Инициализация hot-reload в режиме разработки
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        initHotReload();
    }
});