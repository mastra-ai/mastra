---
'@mastra/core': patch
---

Studio's model provider picker now lists Mastra Gateway even when `MASTRA_GATEWAY_API_KEY` isn't set. Without the key it shows as disconnected, the same way other providers without an API key do. Existing provider policies such as `AUTO_BLOCK_EXTERNAL_PROVIDERS` and model policy still decide what Studio shows.
