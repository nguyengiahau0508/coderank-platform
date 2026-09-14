FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/sessions/stop_words_english.txt ./dist/sessions/
COPY src/sessions/stop_words_vietnamese.txt ./dist/sessions/
COPY src/sessions/stop_words_english.txt ./src/sessions/
COPY src/sessions/stop_words_vietnamese.txt ./src/sessions/

EXPOSE 4000
CMD ["node", "dist/main"]
