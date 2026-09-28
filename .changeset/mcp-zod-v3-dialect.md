---
'@mastra/mcp': patch
---

Fixed MCP tool calls failing when tools are defined with zod v3 schemas. `MCPServer` now advertises tool schemas as JSON Schema 2020-12 instead of 2019-09 (including tuple schemas), and `MCPClient` converts 2019-09 tool schemas from other servers to 2020-12 instead of rejecting every call.
