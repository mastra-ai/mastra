---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Updated to support dual auth system. Adapters now check for both `studio.auth` and `server.auth` when gating RBAC, and route requests to the correct auth provider based on the `x-mastra-client-type` header.
