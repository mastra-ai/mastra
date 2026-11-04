# AgentCore Runtime requires a linux/arm64 container listening on 0.0.0.0:8080.
# `agentcore deploy` builds this via CodeBuild (ARM64) — no local Docker needed.
FROM --platform=linux/arm64 node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
COPY patches ./patches
RUN npm install
COPY . .
RUN npm run build

FROM --platform=linux/arm64 node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
# Region is also set from agentcore.json envVars at deploy time; this is a default.
ENV AWS_REGION=us-east-1

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Run as a non-root user (AgentCore convention).
RUN useradd -m bedrock_agentcore && chown -R bedrock_agentcore:bedrock_agentcore /app
USER bedrock_agentcore

# HTTP (invocations) / MCP / A2A.
EXPOSE 8080 8000 9000

# OpenTelemetry auto-instrumentation -> AgentCore Observability (CloudWatch).
CMD ["node", "--require", "@opentelemetry/auto-instrumentations-node/register", "dist/agent.js"]
