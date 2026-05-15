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

Minimum required `@mastra/core` version is now `>=1.35.0-0`. Older versions don't ship the widened FGA permission types or the new `MASTRA_USER_*` request-context constants these packages consume.
