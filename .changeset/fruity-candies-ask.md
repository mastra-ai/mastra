---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
---

MCP servers mounted on Express, Fastify, Koa and Elysia now pass the authenticated caller to MCP tools, like Hono already did. Tools can read the user and permissions from `requestContext`, and a custom `setRequestAuth` hook is honored on every adapter.
