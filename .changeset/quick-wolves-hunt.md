---
'@mastra/mcp': patch
---

Added Fine-Grained Authorization (FGA) enforcement to MCP tool execution. Both transport-driven calls and direct `executeTool()` calls now run the same authorization checks when a request user is present, and typed FGA permission constants are accepted in MCP server authorization config.
