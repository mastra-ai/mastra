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

Raised the `@mastra/core` peer dependency floor to stable 1.68.0 to match `@mastra/server`, which now resolves provider auth through the core gateway manager. Earlier 1.68.0 prereleases don't export the required API.
