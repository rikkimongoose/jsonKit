# ========== Stage 1: Build Go Service ==========
FROM golang:1.21-alpine AS go-builder

WORKDIR /app
RUN apk add --no-cache git && \
    git clone https://github.com/rikkimongoose/wiregock-app.git . && \
    go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -o /wiregock-app

# ========== Stage 2: Build Node.js UI + Ungit ==========
FROM node:18-alpine AS node-builder

WORKDIR /app
RUN apk add --no-cache git && \
    git clone https://github.com/rikkimongoose/jsonKit.git . && \
    npm install && \
    npm run build

# Устанавливаем Ungit глобально
RUN npm install -g ungit

# ========== Stage 3: Final Image ==========
FROM alpine:latest

WORKDIR /app

# Устанавливаем Git и зависимости Ungit
RUN apk add --no-cache git bash

# Копируем бинарники и приложения
COPY --from=go-builder /wiregock-app /app/wiregock-app
COPY --from=node-builder /app /app/jsonKit
COPY --from=node-builder /usr/lib/node_modules/ungit /usr/lib/node_modules/ungit
COPY --from=node-builder /usr/bin/ungit /usr/bin/ungit

# Создаём директорию для конфигов
ENV MOCKFILES_DIR=/app/mockfiles
RUN mkdir -p ${MOCKFILES_DIR}

# Переменные окружения
# HTTP-порт Node.js
ENV PORT=3000
# WebSocket-порт Node.js 
ENV WS_PORT=3030
# Порт Go-приложения
ENV SERVER_PORT=8080
# Порт Ungit (HTTPS)
ENV UNGIT_PORT=8443
# Директория для Ungit
ENV UNGIT_DIR=${MOCKFILES_DIR}

# Открываем порты
EXPOSE ${SERVER_PORT} ${PORT} ${WS_PORT} ${UNGIT_PORT}

# Запуск всех сервисов через скрипт
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]