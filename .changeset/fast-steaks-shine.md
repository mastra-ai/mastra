---
'@mastra/mcp': patch
---

Expose authProvider option for HTTP-based MCP servers to enable OAuth authentication with automatic token refresh. The authProvider is automatically passed to both Streamable HTTP and SSE transports.
