---
'@mastra/koa': patch
---

Fixed RBAC permission checks rejecting authenticated users with valid permissions. The Koa adapter was reading user permissions from the wrong key in the request context, causing every permission check to deny access (403). Now aligned with the Express, Fastify, and Hono adapters.
