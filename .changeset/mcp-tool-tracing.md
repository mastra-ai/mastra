---
'@mastra/core': minor
---

MCP tool calls now use `MCP_TOOL_CALL` span type instead of `TOOL_CALL` in traces. `CoreToolBuilder` detects `mcpMetadata` on tools and creates spans with MCP server name, version, and tool description attributes.
