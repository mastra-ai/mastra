---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
'@internal/playground': patch
---

Improved Studio agent serialization by making Studio mode and auth-related request context server-controlled across adapters. Playground requests now identify Studio traffic consistently, body and query request context cannot set reserved server values, and Studio placeholder fallback is limited to instruction rendering while serialized models, workspace, skills, tools, and default options use the real request context.
