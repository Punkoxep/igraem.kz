FROM node:20-alpine AS base
WORKDIR /app

# System dependencies
RUN apk add --no-cache openssl

# 1. Backend dependencies & Prisma layer (cached unless package*.json or schema.prisma change)
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci --prefer-offline --no-audit 2>/dev/null || npm install --prefer-offline --no-audit
RUN npx prisma generate

# 2. Frontend dependencies layer (cached unless client/package*.json changes)
COPY client/package*.json client/tsconfig*.json client/vite.config.ts ./client/
RUN cd client && (npm ci --prefer-offline --no-audit 2>/dev/null || npm install --prefer-offline --no-audit)

# 3. Source code & build layer (rebuilds in 2-4 seconds on code change)
COPY src ./src/
RUN npm run build && cp -r src/public dist/public

COPY client ./client/
RUN cd client && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss=false --skip-generate && npm start"]
