---
'@mastra/mcp': patch
---

MCPClient.listTools(), listToolsets() and listToolDefinitions() no longer hand agents the tools an MCP App server marks as app-only (`_meta.ui.visibility: ['app']`). Those tools are meant to be called by the server's app UI, not by the model, so agents no longer see helpers such as data relays in their tool list, including agents rebuilt from a cached tool catalog.
