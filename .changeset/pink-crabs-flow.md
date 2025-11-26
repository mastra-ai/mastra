---
'@mastra/mcp': patch
---

Fix MCP client to return structuredContent directly when tools define an outputSchema, ensuring output validation works correctly instead of failing with "expected X, received undefined" errors.
