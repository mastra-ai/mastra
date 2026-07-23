---
'@mastra/mcp': patch
---

Fixed MCP clients getting stuck after a failed reconnect to streamable-HTTP-only servers. `listTools()`, `callTool()`, and `forceReconnect()` now work once the server is reachable again. Fixes https://github.com/mastra-ai/mastra/issues/19862
