---
'@mastra/mcp': minor
---

Added `coerceSchemasTo` option to MCPClient. Set to `'zod'` to convert MCP tool input schemas from JSON Schema to Zod at load time. This fixes MCP tool calls crashing on Cloudflare Workers and other edge runtimes that block runtime code generation (`new Function()`).
