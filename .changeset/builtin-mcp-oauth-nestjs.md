---
'@mastra/nestjs': patch
---

The built-in MCP endpoint now sends the `WWW-Authenticate` OAuth challenge on `401` and enforces `server.mcp.oauth.resource` as the token audience, matching the other server adapters.
