---
'@mastra/auth': minor
---

Added `jwksUri` and `issuer` options to `MastraJwtAuth`, so it can verify tokens signed by an identity provider instead of only tokens signed with a shared secret. The issuer is advertised to MCP clients by the built-in MCP server, and tokens are checked against `server.mcp.oauth.resource` when it is set.

```ts
new MastraJwtAuth({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com/',
});
```
