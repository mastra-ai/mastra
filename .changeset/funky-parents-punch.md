---
'@mastra/connect': minor
---

Added end-user (per-resource) connections to @mastra/connect.

**Scope tools to an end user**

`tools()` accepts a new `resourceId` option — a static key or a callback derived per request — so an agent resolves the shared global connections plus that end user's own connections. Every platform call made under a resource scope asserts the key, so one user's connection can never serve another user's request.

```ts
import { tools } from '@mastra/connect';

// Per-request scoping on an agent:
new Agent({ tools: ctx => tools({ resourceId: myUserIdFrom(ctx) }) });

// Static/global usage is unchanged:
new Agent({ tools: tools({ providers: ['linear'] }) });
```

Calling `tools()` per request is cheap: identical options share one internal snapshot/MCP-client state, with per-resource caching and eviction. The returned resolver is also awaitable, so a dynamic `tools` argument can return it directly.

**Let end users connect their own accounts**

A new `userConnectRoutes()` export returns mountable API routes (provider catalog, the caller's connections, connect sessions, status polling, disconnect, and a hosted connect page) gated on the authenticated end user's resource key from `server.auth.mapUserToResourceId`.

```ts
import { Mastra } from '@mastra/core';
import { userConnectRoutes } from '@mastra/connect';

export const mastra = new Mastra({
  server: {
    auth: {
      authenticateToken: async token => verifyToken(token),
      mapUserToResourceId: user => user.id,
    },
    apiRoutes: [...userConnectRoutes({ providers: ['linear', 'slack'] })],
  },
});
```

`credential()` also gains an optional `resourceId` option for asserting a resource-scoped connection's key.
