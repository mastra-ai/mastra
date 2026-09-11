---
'@mastra/client-js': minor
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

Added `transports` to MCP server info responses. Consumers can hide the legacy SSE endpoint for MCP v2 servers, which only serve Streamable HTTP.
