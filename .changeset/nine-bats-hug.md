---
'@mastra/mcp': minor
---

MCPClient.listTools(), listToolsets() and listToolDefinitions() no longer hand agents the tools an MCP App server marks as app-only (`_meta.ui.visibility: ['app']`). Those tools are meant to be called by the server's app UI, not by the model, so agents no longer see helpers such as data relays in their tool list, including agents rebuilt with `toolsFromDefinitions()` from a catalog cached before this change. `onServerSettled` callbacks receive the same filtered tools.
