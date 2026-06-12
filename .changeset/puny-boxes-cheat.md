---
'@mastra/core': patch
---

Added `Middleware`, `ServerConfig`, and `Methods` type exports to `@mastra/core/server`. Middleware and server config can now be declared in separate files with full type safety instead of being inlined in the Mastra constructor.

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
