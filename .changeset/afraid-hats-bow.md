---
'@mastra/mcp': minor
---

Added an optional `setRequestAuth` hook to `MCPServer.startHTTP`. It runs once per request, immediately before the request reaches the streamable HTTP transport, letting a host server populate `req.auth` (and therefore `extra.authInfo`) on all paths: existing session, new session, and stateless/serverless.

```ts
await server.startHTTP({
  url,
  httpPath,
  req,
  res,
  setRequestAuth: req => {
    // @ts-ignore - req.auth is read by the MCP SDK
    req.auth = { token, clientId, scopes, extra };
  },
});
```

The hook is framework-agnostic (receives only the Node request) and optional, so existing behavior is unchanged when it is not provided.
