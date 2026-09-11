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

Moved the docs server onto @mastra/mcp 2.x: tools are defined with `createTool`, migration prompts no longer carry the deprecated `version` field, and process logs go to the local log file (MCP 2026-07-28 delivers logs per request rather than per session).
