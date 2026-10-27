---
'@mastra/server': patch
'@mastra/elysia': patch
---

Handler-level FGA checks now use the same auth-mode-aware provider selection as route-level checks, so an app that configures FGA only under `studio` applies it to Studio requests, and a request with no applicable provider is denied instead of treated as unrestricted. The Elysia adapter now reads user permissions from the reserved `mastra__userPermissions` request-context key, matching the Hono, Express, Fastify and Koa adapters.
