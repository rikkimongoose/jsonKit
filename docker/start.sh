#!/bin/bash

# Запуск Go-сервиса
/app/wiregock-app &

# Запуск Node.js-приложения
cd /app/jsonKit && npm start &

# Запуск Ungit с настройками
ungit --port=${UNGIT_PORT} --launchBrowser=false --rootPath=${UNGIT_DIR} &

# Бесконечный цикл, чтобы контейнер не завершался
while true; do sleep 1000; done