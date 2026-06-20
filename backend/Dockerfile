FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser && \
    mkdir -p /app/uploads /app/data && \
    chown -R nodeuser:nodejs /app/uploads /app/data

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

USER nodeuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]