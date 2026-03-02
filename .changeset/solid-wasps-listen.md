---
'@mastra/mcp': patch
---

Fixed MCP tool results being silently stripped to empty objects (`{}`) when the server's output schema doesn't exactly match the returned data. Zod's default behavior removes unknown keys during validation, which caused tools (especially FastMCP servers) to return `{}` instead of the full result. Output schemas now preserve all fields returned by the MCP server.
