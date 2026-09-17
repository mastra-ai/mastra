---
'@mastra/mcp': patch
---

Fix type errors when passing consumer Hono SSE streams and contexts to MCPServer. Hono is now a required peer dependency (`^4.12.8`), and the public SSE boundary uses structural types so consumer values remain compatible while Hono declarations continue to be bundled during type generation.
