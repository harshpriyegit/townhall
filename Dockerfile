# Base image for building the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configurations
COPY package*.json ./
COPY server/package*.json ./server/

# Install all dependencies (including devDependencies)
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN cd server && npx prisma generate

# Build Frontend Assets
RUN npx vite build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma's musl binaries (libssl.so.1.1)
RUN apk add --no-cache openssl

# Copy server package configuration and install production dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy generated Prisma Client
COPY --from=builder /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY --from=builder /app/server/node_modules/@prisma/client ./server/node_modules/@prisma/client

# Copy server source code and prisma schema
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/server/prisma ./server/prisma

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p server/uploads

# Expose backend API and Socket port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the application
CMD ["node", "server/src/index.js"]
