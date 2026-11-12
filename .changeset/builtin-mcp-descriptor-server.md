---
'@mastra/server': minor
---

Added `GET /api/mcp/builtin`, which describes the built-in MCP server so Studio and other clients can show how to connect to it. It returns whether the server is enabled (and why not), its endpoint path, whether `@mastra/mcp` is installed, the toolsets it serves, read-only mode, and whether it's open or protected by `server.auth` (with the provider name). It needs the `mcp:read` permission and never returns agent, workflow, or tool ids or auth configuration.
