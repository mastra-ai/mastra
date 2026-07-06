---
'@mastra/deployer': minor
'@mastra/core': minor
---

Added file-system routed studio config singleton. Place a studio.ts file in your mastra directory that default-exports a StudioConfig object, and it will be auto-discovered and registered when running mastra dev or mastra build. Code-registered studio config takes precedence if both are present.
