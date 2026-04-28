---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed server adapters to read auth context keys with the `mastra__` prefix (`mastra__userPermissions`, `mastra__userRoles`, `mastra__user`). This aligns the adapters with the updated reserved context key names set by the auth helpers.
