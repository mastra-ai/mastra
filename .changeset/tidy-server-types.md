---
'@mastra/core': patch
---

Added the `ServerConfig` and `Methods` type exports to `@mastra/core/server`. Server config and HTTP methods can now be declared in a separate file with full type safety. This complements the `Middleware` export and lets you name the type of `ApiRoute['method']`, which was previously unreachable.

```ts
import type { ServerConfig, Methods } from '@mastra/core/server';

const protectedMethods: Methods[] = ['POST', 'PUT', 'DELETE'];

export const serverConfig: ServerConfig = {
  port: 4111,
  middleware: async (c, next) => {
    await next();
  },
};
```
