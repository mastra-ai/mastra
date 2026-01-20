---
'mastra': patch
---

Fixed studio CLI not replacing all placeholder variables in index.html, which caused requests to malformed URLs like `%%MASTRA_CLOUD_API_ENDPOINT%%/api/agents`.
