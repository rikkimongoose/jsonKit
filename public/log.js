// Toastr config
toastr.options = {
    "closeButton": true,              // Отображение кнопки "Закрыть"
    "debug": false,                   // Отключение режима отладки
    "newestOnTop": false,             // Расположение новых сообщений вверху
    "progressBar": true,              // Отображение прогресс-бара
    "positionClass": "toast-top-right", // Позиция (например, в правом верхнем углу)
    "preventDuplicates": true,        // Запрет на повторяющиеся сообщения
    "showDuration": "300",            // Длительность показа (мс)
    "hideDuration": "1000",           // Длительность скрытия (мс)
    "timeOut": "5000",                // Время автоматического скрытия (мс)
    "extendedTimeOut": "1000",        // Расширенное время для взаимодействия (мс)
    "showEasing": "swing",            // Анимация появления
    "hideEasing": "linear",           // Анимация скрытияn
    "showMethod": "fadeIn",           // Метод появления
    "hideMethod": "fadeOut"           // Метод скрытия
};

const Logger = {
    Info: function (message, title, optionsOverride) {
        console.info(message, title);
        toastr.info(message, title, optionsOverride);
    },
  
    Error: function (message, title, optionsOverride) {
        console.error(message, title);
        toastr.error(message, title, optionsOverride);
    },
  
    Warning: function (message, title, optionsOverride) {
        console.warn(message, title);
        toastr.warning(message, title, optionsOverride);
    },
  
    Success: function (message, title) {
        console.info(message, title);
        toastr.success(message, title, optionsOverride);
    },
  
    Debug: function (...args) {
        console.log(args);
    }
  };