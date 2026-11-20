# Stage 1: Build the Vite React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definitions and source files
COPY package.json ./
COPY . .

# Build the production bundle into dist/
RUN npm run build

# Stage 2: Lightweight Production Server for Cloud Run
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# server/prod.js uses 100% native Node.js APIs (http, crypto, fs)
# Zero production node_modules needed at runtime!
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080

CMD ["node", "server/prod.js"]
