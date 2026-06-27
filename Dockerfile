FROM node:22-slim AS build

WORKDIR /app

COPY mobile/package*.json ./mobile/
COPY mobile/scripts ./mobile/scripts
RUN npm ci --prefix mobile

COPY mobile ./mobile
RUN npm run build:web --prefix mobile

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY server ./server
COPY --from=build /app/mobile/dist-web ./mobile/dist-web

EXPOSE 8080
CMD ["node", "server/server.js"]
