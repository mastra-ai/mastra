---
'@mastra/core': patch
---

Fixed unclear errors for Mastra Gateway models (`mastra/<provider>/<model>`) when `MASTRA_GATEWAY_API_KEY` isn't set. Agents now fail with `Missing MASTRA_GATEWAY_API_KEY environment variable` instead of `Could not find config for provider mastra`, and agents using `webSearchTool` no longer fail first with `Could not infer a supported provider from "mastra"`.
