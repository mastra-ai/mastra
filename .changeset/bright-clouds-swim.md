---
'@mastra/cli': patch
'@mastra/playground': patch
---

Fixed studio CLI not replacing all placeholder variables in index.html, which caused requests to malformed URLs like `%%MASTRA_CLOUD_API_ENDPOINT%%/api/agents`.

Added support for optional server port - when not specified, the URL is built without a port suffix. This allows connecting to hosted Mastra servers that don't use a custom port.
