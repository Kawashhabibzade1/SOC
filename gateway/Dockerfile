# ─────────────────────────────────────────────
# SOC Radar - Phase 2 Gateway
# Dockerfile
# ─────────────────────────────────────────────

# Use the official Node.js LTS Alpine image for a minimal footprint (~50MB)
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (layer caching — only re-installs when these change)
COPY package.json package-lock.json* ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY server.js ./

# Run as the built-in non-root 'node' user for container security
USER node

# Expose the gateway port
EXPOSE 3001

# Health check — Docker will mark the container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
