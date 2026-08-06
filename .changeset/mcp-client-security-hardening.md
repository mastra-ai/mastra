---
'@mastra/mcp': minor
---

Add opt-in security hardening options to the MCP client: `allowedHosts` on HTTP server configs restricts which hosts the client's HTTP requests (including redirect hops, the SSE fallback, and OAuth discovery) may target, and `inheritDefaultEnv: false` on stdio server configs stops the subprocess from inheriting the SDK's default environment variables. Both options are opt-in; default behavior is unchanged.
