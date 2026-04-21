---
'@mastra/mcp': patch
---

Fixed MCP tool execution authorization so direct `executeTool()` calls also enforce FGA when a request user is present.

This keeps MCP transport execution and direct server-side execution on the same permission boundary instead of only protecting the transport-specific path.
