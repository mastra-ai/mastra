---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed refreshed session cookies being lost in the standalone `createAuthMiddleware` for Express, Fastify, Hono, and Koa. Browsers now receive the refreshed `Set-Cookie` on both allowed and denied requests. Fixes #24963.
