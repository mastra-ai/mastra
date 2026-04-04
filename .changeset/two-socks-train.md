---
'@mastra/server': patch
---

Fixed gateway memory client failing with 404 when MASTRA_GATEWAY_URL includes a /v1 suffix (e.g. https://gateway-api.mastra.ai/v1). The URL is now normalized before appending the memory base path, matching how the model router handles the same variable.
