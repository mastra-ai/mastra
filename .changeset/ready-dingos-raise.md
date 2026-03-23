---
'@mastra/longmemeval': patch
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'create-mastra': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/opencode': patch
'@mastra/datadog': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/daytona': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloud': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'mastracode': patch
'@mastra/pg': patch
---

Fixed Harness stateSchema typing to accept Zod schemas with .default(), .optional(), and .transform() modifiers. Previously, these modifiers caused TypeScript errors because the type system forced schema Input and Output types to be identical. Now stateSchema correctly accepts any schema regardless of input type divergence.
