---
'@mastra/mcp': patch
---

Fix MCPClient automatic reconnection when session becomes invalid

When an MCP server restarts, the session ID becomes invalid causing "Bad Request: No valid session ID provided" errors. The MCPClient now automatically detects session-related errors, reconnects to the server, and retries the tool call.

This fix addresses issue #7675 where MCPClient would fail to reconnect after an MCP server went offline and came back online.

