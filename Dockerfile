FROM node:22-alpine AS builder
WORKDIR /app

# Backend deps
COPY package*.json ./
RUN npm ci

# Frontend deps
COPY web-frontend/package*.json ./web-frontend/
RUN cd web-frontend && npm ci

# Build everything
COPY . .
RUN npm run build
RUN cd web-frontend && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web-frontend/dist ./dist/web/public
CMD ["node", "dist/index.js"]
