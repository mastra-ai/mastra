---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Fixed authentication bypass for custom routes in dev mode. Routes registered with registerApiRoute and requiresAuth: true now correctly enforce authentication even when MASTRA_DEV=true.
