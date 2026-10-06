---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

Resource read results from MCP servers now include the optional `mimeType` and `_meta` fields, both in the `MCPServerBase.readResource()` type and in the `POST /mcp/:serverId/resources/read` response returned to `readMcpServerResource()`.
