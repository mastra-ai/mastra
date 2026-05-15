---
'@mastra/server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-vercel': patch
'mastra': patch
'@mastra/temporal': patch
---

Bumped `@mastra/core` peer dependency floor to `>=1.35.0-0` so the widened FGA permission types and `MASTRA_USER_*` request-context constants are available. The floor cascades through packages that transitively depend on `@mastra/server` or `@mastra/deployer` to satisfy the workspace peer-dep subset rule.
