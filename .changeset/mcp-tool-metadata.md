---
'@mastra/mcp': minor
---

MCP client now attaches `mcpMetadata` (server name and version) to every tool it creates, enabling automatic `MCP_TOOL_CALL` span tracing without user code changes.
