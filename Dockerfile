FROM node:24-bookworm-slim
WORKDIR /app
COPY server/ ./server/
COPY public/ ./public/
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "server/hosted.mjs"]
