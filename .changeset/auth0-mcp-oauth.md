---
'@mastra/auth-auth0': minor
---

The built-in MCP server now advertises your Auth0 tenant to MCP clients for sign-in, and rejects tokens whose audience does not include `server.mcp.oauth.resource` when it is set.
