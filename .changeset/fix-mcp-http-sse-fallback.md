---
"@mastra/mcp": patch
---

Fix HTTP SSE fallback to only trigger for 400/404/405 per MCP spec

With @modelcontextprotocol/sdk 1.24.0+, SSE fallback now only occurs for HTTP status codes 400, 404, and 405. Other errors (like 401 Unauthorized) are re-thrown for proper handling.

Older SDK versions maintain the existing behavior (always fallback to SSE).
