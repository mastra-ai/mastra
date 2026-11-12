---
'@mastra/hono': patch
---

Fixed MCP requests to a Hono server occasionally failing with `400 Parse error: Invalid JSON` on Node.js 22, most often on the first request after the server starts. The request body could become unreadable before the MCP transport read it.
