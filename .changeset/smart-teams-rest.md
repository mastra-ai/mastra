---
'@mastra/mcp': minor
---

Added `reconnectServer(serverName)` method for per-server reconnection without disconnecting all servers. Added `listToolsetsWithErrors()` method that returns both successful toolsets and per-server error details, improving error visibility compared to `listToolsets()` which silently skips failed servers. Added `getServerStderr(serverName)` to access piped stderr streams from stdio-based MCP servers.
