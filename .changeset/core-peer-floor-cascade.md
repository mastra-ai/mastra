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

Fixed compatibility by requiring @mastra/core 1.80.0 or newer. These packages build on @mastra/server, which now needs core 1.80.0 to send provider error facts to the client, but they still advertised support for older core versions. Installing one of those older pairings produced a broken setup instead of a clear version conflict.

If your package manager reports a peer conflict after this release, upgrade @mastra/core first, then the package:

```bash
pnpm add @mastra/core@^1.80.0
pnpm add @mastra/deployer@latest
```

Before, a project could pair @mastra/deployer with @mastra/core 1.78 and install cleanly; after, that pairing is refused at install time instead of failing at runtime.
