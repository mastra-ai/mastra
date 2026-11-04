---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

MCP servers mounted on Express, Fastify, Koa, Elysia and NestJS now pass the authenticated caller to MCP tools, like Hono already did. Tools can read the user and permissions from `requestContext`. A custom `setRequestAuth` hook is honored on every adapter, and NestJS now accepts it in `mcpOptions`.
