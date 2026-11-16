---
'@mastra/server': patch
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
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
'@mastra/temporal': patch
'mastra': patch
---

Raised the @mastra/core peer floor to 1.84.0 so it matches @mastra/server, which now uses stripClientAuthoredTurnMarks.
