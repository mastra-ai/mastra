---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed observability singleton. Place an observability.ts file in your mastra directory that default-exports an ObservabilityEntrypoint, and it will be auto-discovered and registered when running mastra dev or mastra build. Code-registered observability takes precedence if both are present.
