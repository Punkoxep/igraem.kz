FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm install

COPY src ./src/

RUN npx prisma generate
RUN npm run build

# Copy frontend client and build
COPY client ./client/
RUN cd client && npm install && npm run build

# Copy static public assets to dist/public
RUN cp -r src/public dist/public

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss=false --skip-generate && npm start"]
