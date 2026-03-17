---
"@mastra/hono": patch
---

Fixed auth middleware execution order in the Hono adapter. Previously, `requestContext.get('user')` always returned null inside `server.middleware` because authentication ran per-route after custom middleware. Now `authenticateToken` runs eagerly as a global middleware, populating `requestContext` with the user before `server.middleware` executes. Per-route auth enforcement is unchanged.
