---
'@mastra/core': patch
'@mastra/mcp': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Preserve optional `mimeType` and `_meta` on proxied MCP resource read contents, including MCP App `ui://` resources. Expose these fields in the public resource-read contracts and API response schema.
