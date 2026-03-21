FROM node:22-slim

# Install procps (provides ps, needed by tree-kill)
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install (need devDeps for tsx)
COPY package.json ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ src/

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/server.ts"]
