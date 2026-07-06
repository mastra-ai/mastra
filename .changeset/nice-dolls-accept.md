---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed server config singleton. Place a server.ts file in your mastra directory that default-exports a ServerConfig object, and it will be auto-discovered and registered when running mastra dev or mastra build. Code-registered server config takes precedence if both are present.
