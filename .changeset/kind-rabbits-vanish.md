---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Added adapter auth middleware helpers for raw framework routes.

Use `createAuthMiddleware({ mastra })` when you mount routes directly on a Hono, Express, Fastify, or Koa app and still want Mastra auth to run. Set `requiresAuth: false` when you need to reuse the same helper chain on a public route.

```ts
app.get('/custom/protected', createAuthMiddleware({ mastra }), handler);
```
