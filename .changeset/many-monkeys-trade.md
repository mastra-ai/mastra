---
'@mastra/core': minor
---

Added Hono handler and route types to the server exports.

```ts
import type { MiddlewareHandler } from '@mastra/core/server';

const middleware: MiddlewareHandler = async (_context, next) => {
  await next();
};
```
