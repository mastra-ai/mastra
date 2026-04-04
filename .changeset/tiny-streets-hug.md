---
'mastra': patch
---

Renamed GATEWAY_URL and GATEWAY_API_KEY env vars to MASTRA_GATEWAY_URL and MASTRA_GATEWAY_API_KEY to match the mastra provider in core. Gateway agents now use the mastra/ model string directly instead of generating a shared.ts file.
