---
'@mastra/mcp': patch
---

Fixed MCP tool calls failing when tools are defined with zod v3 schemas. `MCPServer` now advertises tool schemas as JSON Schema 2020-12 instead of 2019-09 (including tuple schemas), and `MCPClient` validates schemas declaring an unsupported dialect as 2020-12 instead of rejecting every call.
