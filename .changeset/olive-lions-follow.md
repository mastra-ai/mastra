---
'mastra': patch
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
---

Fixed compatibility by requiring @mastra/core 1.58.0 or newer. These packages all build on @mastra/server, which needs core 1.58.0, but they still advertised support for core versions as old as 1.50.0. Installing one of those older pairings produced a broken setup instead of a clear version conflict.

If your package manager reports a peer conflict after this release, upgrade @mastra/core to 1.58.0 or newer.
