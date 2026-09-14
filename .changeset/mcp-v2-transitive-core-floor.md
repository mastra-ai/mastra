---
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer-vercel': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
'@mastra/temporal': patch
'mastra': patch
---

Raise the `@mastra/core` peer floor to `1.68.0` so runtime dependencies on `@mastra/server`, `@mastra/hono` and `@mastra/deployer` resolve the MCP server registry union.
