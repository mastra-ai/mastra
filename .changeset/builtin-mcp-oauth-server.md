---
'@mastra/server': minor
---

Added OAuth discovery to the built-in MCP server. When `server.auth` is configured, MCP clients that get a `401` from `/api/mcp` now receive a `WWW-Authenticate` header pointing at protected-resource metadata served at `/.well-known/oauth-protected-resource`, so they can discover where to sign in. The challenge, the metadata routes, and the audience check below only apply to `/api/mcp`.

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

Auth providers that can't check the audience, such as `SimpleAuth` API keys, are still accepted, and a warning is logged at startup. Set `requireAudience: true` to reject them on `/api/mcp`, including inside `CompositeAuth`:

```ts
mcp: { oauth: { resource: 'https://my-app.example.com/api/mcp', requireAudience: true } },
```

See the [built-in MCP server docs](https://mastra.ai/docs/server/mcp#oauth-discovery).
