---
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/client-js': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

MCP server and tool listings now report which transports a server offers (`streamable-http`, plus `sse` for MCP 1.x servers), so clients can tell modern-only MCP v2 servers apart without probing routes. Tool listings from MCP v2 servers keep the `id` Studio uses to execute them.
