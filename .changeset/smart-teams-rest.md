---
'@mastra/mcp': minor
---

Added new MCP client APIs for per-server control and diagnostics.

- Added `reconnectServer(serverName)` to reconnect a single MCP server without restarting all servers.
- Added `listToolsetsWithErrors()` to return both toolsets and per-server errors.
- Added `getServerStderr(serverName)` to inspect piped stderr for stdio servers.

**Example**
```ts
const { toolsets, errors } = await mcpClient.listToolsetsWithErrors();
await mcpClient.reconnectServer('slack');
const stderr = mcpClient.getServerStderr('slack');
```
