FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/admin-portal/package.json frontend/admin-portal/tsconfig.json frontend/admin-portal/next-env.d.ts frontend/admin-portal/next.config.mjs /app/
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY frontend/admin-portal /app
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
