---
'@mastra/deployer': patch
'@mastra/elysia': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer-vercel': patch
'mastra': patch
'@mastra/temporal': patch
---

Require `@mastra/core >=1.83.0-0 <2.0.0-0` to match the server's agent-scoped transport requirement. Upgrade core, server, and Inngest together; mixed versions cannot observe or abort each other's in-flight runs.
