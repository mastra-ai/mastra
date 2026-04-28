---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fixed server adapters not forwarding authenticated user identity and permissions to route handlers. Auth-gated features like agent ownership now work correctly across all adapter frameworks.
