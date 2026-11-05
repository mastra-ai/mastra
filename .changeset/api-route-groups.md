---
'@mastra/core': minor
---

Added route groups for API route factories that register multiple HTTP methods or paths.

```ts
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute, registerApiRouteGroup } from '@mastra/core/server';

function chatRoutes() {
  const postRoute = registerApiRoute('/chat', {
    method: 'POST',
    handler: async () => Response.json({ started: true }),
  });

  const reconnectRoute = registerApiRoute('/chat/runs/:runId', {
    method: 'GET',
    handler: async c => Response.json({ runId: c.req.param('runId') }),
  });

  return registerApiRouteGroup(postRoute, [reconnectRoute]);
}

const mastra = new Mastra({
  server: {
    apiRoutes: [chatRoutes()],
  },
});
```

Mastra recursively expands the group during server configuration, registering both `POST /chat` and `GET /chat/runs/:runId`. Direct consumers can continue using the factory result as the primary POST route.
