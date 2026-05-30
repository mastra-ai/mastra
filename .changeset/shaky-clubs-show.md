---
'@mastra/mcp': minor
---

Added an MCP client option to convert MCP tool input schemas to Zod so edge runtimes can avoid AJV code generation during tool input validation. Clients now also cache separate instances for different schema coercion modes.
