---
'@mastra/hono': minor
---

Populated `MASTRA_FRAMEWORK_PUBLIC_KEY` on the Hono context inside `registerContextMiddleware()` and exported a new `skipIfFrameworkPublic` middleware wrapper.

Adapter authors can now wrap any user middleware to guarantee it does not run for routes declared public via `createPublicRoute()` or `requiresAuth: false`.

```ts
import { skipIfFrameworkPublic } from '@mastra/hono';

for (const m of userMiddleware) {
  app.use(m.path, skipIfFrameworkPublic(m.handler));
}
```
