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

Studio only shows the Server-Sent Events endpoint for MCP 1.x servers; MCP v2 servers list Streamable HTTP alone. Running a tool that needs native MCP input rounds now shows a clear unsupported-interaction result instead of an empty result, and other execution failures are surfaced in the result panel.
