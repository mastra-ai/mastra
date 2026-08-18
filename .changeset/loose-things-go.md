---
'@mastra/server': minor
'@mastra/hono': minor
'@mastra/core': minor
'@mastra/mcp': minor
---

MCP tools served over HTTP now see the authenticated caller. When an MCP server runs behind a Mastra server with `server.auth` configured, the resolved user is bridged into `extra.authInfo` automatically, on both the streamable HTTP and SSE transports. Previously `extra.authInfo` was always undefined because the request handed to the MCP transport was rebuilt without the auth data.

**Custom verification**

If your own middleware verifies the caller, build the auth info yourself with the new `server.mcpOptions.setRequestAuth` hook:

```ts
export const mastra = new Mastra({
  mcpServers: { myServer },
  server: {
    middleware: [verifyBearerToken],
    mcpOptions: {
      setRequestAuth: (req, requestContext) => {
        const payload = requestContext.get('bearerPayload');
        req.auth = { token: payload.token, clientId: payload.sub, scopes: payload.scope.split(' ') };
      },
    },
  },
});
```

Fixes #17291
