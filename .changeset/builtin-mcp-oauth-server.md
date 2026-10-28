---
'@mastra/server': minor
---

Added OAuth discovery to the built-in MCP server. When `server.auth` is configured, MCP clients that get a `401` from `/api/mcp` now receive a `WWW-Authenticate` header pointing at protected-resource metadata served at `/.well-known/oauth-protected-resource`, so they can find your identity provider and sign in on their own. Other routes are unchanged.

Set `server.mcp.oauth.resource` to the public URL of the endpoint to also reject tokens issued for a different API:

```ts
export const mastra = new Mastra({
  server: {
    auth: new MastraJwtAuth({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com/',
    }),
    mcp: { oauth: { resource: 'https://my-app.example.com/api/mcp' } },
  },
});
```

See the [built-in MCP server docs](https://mastra.ai/docs/server/mcp#oauth-discovery).
