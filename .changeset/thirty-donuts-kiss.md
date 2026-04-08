---
'@mastra/mcp': patch
---

Fixed MCP server to return HTTP 404 (instead of 400) when a client sends a stale or unknown session ID. Per the MCP spec, this tells clients to re-initialize with a new session, which fixes broken tool calls after server redeploys.
