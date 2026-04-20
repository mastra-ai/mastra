---
'@mastra/mcp': patch
---

Fixed MCP tool strict mode propagation. MCP servers now expose Mastra tool strictness in MCP metadata, and the MCP client restores that flag when rebuilding tools so strict OpenAI tool calling works for MCP-backed tools too.
