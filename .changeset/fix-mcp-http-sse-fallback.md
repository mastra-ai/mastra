---
"@mastra/mcp": patch
---

With @modelcontextprotocol/sdk 1.24.0+, SSE fallback now only occurs for HTTP status codes 400, 404, and 405. Other errors (like 401 Unauthorized) are re-thrown for proper handling.

Older SDK versions maintain the existing behavior (always fallback to SSE).
