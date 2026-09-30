---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
---

Fixed `createAuthMiddleware` returning 401 for custom API routes registered with `requiresAuth: false`. When the helper was mounted on a path that also served a public custom route (for example `app.use('*', createAuthMiddleware({ mastra }))`), it re-marked that route as protected. Public routes, including pattern routes such as `/webhooks/:id`, now stay public without also being listed in `authConfig.public`.
