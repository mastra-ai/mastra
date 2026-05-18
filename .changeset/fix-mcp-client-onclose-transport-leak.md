---
'@mastra/mcp': patch
---

Fixed a transport leak when the MCP server closes the connection.
The client now cleans up the previous transport before reconnecting.
This prevents repeated retry loops and avoids server session buildup during repeated disconnects. See `#16693`.
