---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed standalone `createAuthMiddleware` dropping refreshed session headers (such as `Set-Cookie`) after a transparent session refresh. The refreshed cookie now reaches the browser on both allowed and denied requests, matching `MastraServer` behavior. Fixes #24963.
