---
'@mastra/core': patch
---

Added runtime configuration support to MastraGateway (apiKey, baseUrl, customFetch). When a custom fetch function is provided, the gateway uses X-Mastra-Authorization for gateway auth, allowing OAuth tokens to be passed via the standard Authorization header.
