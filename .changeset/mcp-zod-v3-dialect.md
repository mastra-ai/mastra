---
'@mastra/mcp': patch
---

Fixed MCP tool calls failing with a schema validation error when tools are defined with zod v3 schemas. `MCPClient` also now accepts tools from other MCP servers that describe their inputs with JSON Schema draft 2019-09.
