---
'@mastra/mcp': patch
---

Fixed MCP clients on 2025 protocol versions, such as the MCP Inspector, failing with "Method not found" against HTTP MCP servers. These clients set the log level when they connect, and the server now answers that request instead of rejecting it.
