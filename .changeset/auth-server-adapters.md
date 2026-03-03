---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Added RBAC permission enforcement to all server adapters. When an auth provider is configured, each route's required permission is checked against the authenticated user's permissions before the handler runs. Permissions are derived automatically from route paths and HTTP methods using the convention-based system from `@mastra/server`.
