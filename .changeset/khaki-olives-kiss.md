---
'create-factory': patch
'@mastra/platform-workspace': patch
---

Fixed newly scaffolded factories to use PlatformSandbox locally by resolving or creating their production environment for MASTRA_ENVIRONMENT_ID. Restored sandbox selection with a local MASTRA_PLATFORM_SECRET_KEY, while preferring the deployed MASTRA_PLATFORM_ACCESS_TOKEN when present.
