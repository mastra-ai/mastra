---
'@mastra/google-cloud-pubsub': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/nestjs': patch
'@mastra/deployer-cloudflare': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/temporal': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/inngest': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'mastra': patch
---

Fixed peer dependency ranges so packages that use the Mastra server require a compatible Mastra core version.
