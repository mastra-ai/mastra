---
'@mastra/nestjs': patch
---

The built-in MCP endpoint now supports OAuth discovery, like the other server adapters. A `401` from `/api/mcp` carries a `WWW-Authenticate` header pointing at protected-resource metadata, which the module serves at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/api/mcp`. When `server.mcp.oauth.resource` is set, the token audience must include it.
