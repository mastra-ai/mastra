FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.js relay.js ./
RUN chown -R 10001:10001 /app && chmod 755 /app
USER 10001:10001
ENTRYPOINT ["node", "/app/server.js"]
