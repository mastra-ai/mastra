---
'@mastra/core': patch
---

Studio now always lists Mastra Gateway in its model provider picker. If `MASTRA_GATEWAY_API_KEY` isn't set, it shows as disconnected, the same way other providers without an API key do. Before, Studio hid it until the key was set.
