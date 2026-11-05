---
'@mastra/mcp': minor
---

MCP tools now receive the caller that Mastra server auth resolved (user, permissions, roles, resource and organization) in `requestContext` when the server is mounted on a Mastra server adapter. These values come only from the server, never from the token or headers the client sends.
