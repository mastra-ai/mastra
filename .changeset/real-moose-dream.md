---
'@mastra/mcp': patch
---

Fixed MCP server returning confusing output schema errors when tool input fails Zod validation but passes JSON Schema validation. The server now correctly returns `isError: true` with the validation error message.
