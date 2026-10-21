---
'@mastra/connect': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer-vercel': patch
'@mastra/elysia': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/mcp': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/server': patch
'@mastra/tanstack-start': patch
'@mastra/temporal': patch
'mastra': patch
---

`@mastra/mcp` and `@mastra/server` now require `@mastra/core` 1.79.0 or later, the first version that exports `MCP_SERVER_EVENT_ERROR_IDS`. Packages that depend on them (`@mastra/connect`, `@mastra/deployer`, the deployers, the server adapters, `@mastra/temporal` and `mastra`) now require the same `@mastra/core` version.
