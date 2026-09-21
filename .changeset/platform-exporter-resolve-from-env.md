---
'@mastra/observability': patch
---

Added a `resolveFromEnv` option to `MastraPlatformExporter` so embedding hosts can pass credentials explicitly and ignore `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_CLOUD_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` from the environment.
