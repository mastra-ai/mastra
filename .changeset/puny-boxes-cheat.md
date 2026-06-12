---
'@mastra/core': patch
---

Added the `Middleware` type export to `@mastra/core/server`. Middleware can now be declared in a separate file with full type safety instead of being inlined in the Mastra constructor.

```ts
import type { Middleware } from '@mastra/core/server';

export const authMiddleware: Middleware = {
  path: '/*',
  handler: async (c, next) => {
    if (!c.req.header('authorization')) {
      return new Response('Unauthorized', { status: 401 });
    }
    await next();
  },
};
```
