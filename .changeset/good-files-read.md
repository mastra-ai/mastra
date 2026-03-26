---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'mastra': patch
---

Added support for `MASTRA_TELEMETRY_ENDPOINT` environment variable. When set, the studio reads observability data from the specified remote telemetry service instead of the local Mastra server.
