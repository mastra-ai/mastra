---
'@mastra/mcp': patch
---

Fix type errors when passing consumer Hono SSE streams and contexts to MCPServer. Hono is now a required peer dependency (`^4.12.8`) rather than a vendored declaration copy, preserving type identity across the public API.
