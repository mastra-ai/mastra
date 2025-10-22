FROM node:20-slim

WORKDIR /app

# Set low memory limit for Node
ENV NODE_OPTIONS="--max-old-space-size=256"

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source files needed for test
COPY src/stream ./src/stream
COPY src/agent ./src/agent
COPY src/processors ./src/processors
COPY src/loop ./src/loop
COPY src/memory-leak-oom-test.ts ./src/

# Copy tsconfig
COPY tsconfig.json ./

CMD ["pnpm", "tsx", "src/memory-leak-oom-test.ts"]
