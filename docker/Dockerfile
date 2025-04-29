# ========== Stage 1: Build Go Service (wiregock-app) ==========
FROM golang:1.21-alpine AS go-builder

WORKDIR /app

# Клонируем и собираем Go-приложение
RUN apk add --no-cache git && \
    git clone https://github.com/rikkimongoose/wiregock-app.git . && \
    go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -o /wiregock-app

# ========== Stage 2: Build Node.js UI (jsonKit) ==========
FROM node:18-alpine AS node-builder

WORKDIR /app

# Клонируем и устанавливаем зависимости Node.js
RUN apk add --no-cache git && \
    git clone https://github.com/rikkimongoose/jsonKit.git . && \
    npm install && \
    npm run build

# ========== Stage 3: Final Image ==========
FROM alpine:latest

WORKDIR /app

# Устанавливаем Git (для работы с конфигами)
RUN apk add --no-cache git

# Копируем бинарник Go и Node.js-приложение
COPY --from=go-builder /wiregock-app /app/wiregock-app
COPY --from=node-builder /app /app/jsonKit

# Создаём директорию для конфигов (будет заменена volume)
ENV MOCKFILES_DIR=/app/mockfiles
RUN mkdir -p ${MOCKFILES_DIR}

# Дефолтные переменные окружения
# HTTP-порт Node.js
ENV PORT=3000       
# WebSocket-порт Node.js
ENV WS_PORT=3030    
# Порт Go-приложения
ENV SERVER_PORT=8080  

# Открываем порты
EXPOSE ${SERVER_PORT} ${PORT} ${WS_PORT}

# Запуск сервисов
CMD sh -c "\
  (cd /app/jsonKit && npm start) & \
  /app/wiregock-app"