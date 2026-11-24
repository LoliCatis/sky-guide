# Образ сайта: сборка интерфейса (Vite) + сервер на Node 22. Инструкция: DOCKER.md
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data ICONS_DIR=/app/db/icons AUTH_LOCAL=0
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY client/public ./client/public
# data — изменяемые данные (том), packs и db/icons — ресурс-паки и иконки (тома только для чтения)
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN mkdir -p data packs db/icons && chown node:node data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Стартует от root только чтобы поправить владельца data, сам сайт работает от пользователя node
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server/index.js"]
