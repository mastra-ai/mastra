---
'@mastra/core': minor
'@mastra/hono': minor
'@mastra/deployer': patch
---

Added `phase: 'afterAuth'` for server middleware. Middleware with this phase runs after the request is authenticated, so it can read the authenticated user from the request context under `MASTRA_USER_KEY`. It doesn't run when authentication fails or on routes declared `requiresAuth: false`. Middleware without a phase still runs before authentication.

```ts
import { MASTRA_USER_KEY } from '@mastra/server/auth';

new Mastra({
  server: {
    middleware: [
      {
        path: '/api/*',
        phase: 'afterAuth',
        handler: async (c, next) => {
          const user = c.get('requestContext').get(MASTRA_USER_KEY);
          console.log(`Request from ${user?.id}`);
          await next();
        },
      },
    ],
  },
});
```

Supported on Hono-based servers (`mastra dev`, `mastra build`, and `@mastra/hono`).
