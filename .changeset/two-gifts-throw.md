---
'@mastra/core': minor
'@mastra/hono': minor
---

Bridge Hono-layer authentication into the MCP request's `req.auth` so `extra.authInfo` reaches MCP tools when MCP servers are deployed behind Hono (the default `mastra dev`/`mastra build` server).

Previously this flow only worked under Express-style bare HTTP servers because the Hono deployer regenerates the request, dropping any `req.auth` set in middleware. Two ways to bridge are now available via `mastra.server.mcp`:

**Automatic (provider auto-bridge)**

When a `server.auth` provider is configured, the authenticated user is mapped into `req.auth` automatically. No extra wiring is required. Works with any `MastraAuthProvider`.

```ts
new Mastra({
  server: {
    auth: new MastraJwtAuth({ secret: process.env.JWT_SECRET! }),
    // optional: customize the user -> AuthInfo mapping
    mcp: { mapUserToAuthInfo: ({ user, token }) => ({ token, clientId: user.sub, extra: { user } }) },
  },
});
```

**Manual (custom middleware)**

For custom Hono auth gates, read the request context and assign `req.auth` yourself:

```ts
new Mastra({
  server: {
    mcp: {
      setRequestAuth: ({ req, requestContext, token }) => {
        const payload = requestContext.get('auth.payload');
        // @ts-ignore - req.auth is read by the MCP SDK
        if (payload) req.auth = { token, clientId: payload.azp, extra: payload };
      },
    },
  },
});
```
