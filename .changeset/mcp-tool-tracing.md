---
'@mastra/core': minor
'@mastra/mcp': minor
'@mastra/playground-ui': patch
---

MCP tool calls now use `MCP_TOOL_CALL` span type instead of `TOOL_CALL` in traces. When an agent calls a tool from an MCP server, the trace span shows `mcp_tool_call` with MCP server name and version attributes. The playground displays an MCP-specific icon for these spans. No user code changes needed — metadata is automatically injected by the MCP client.
