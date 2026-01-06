---
'@mastra/fastify': minor
'@mastra/koa': minor
---

feat: Add Fastify and Koa server adapters

Introduces two new server adapters for Mastra:

- **@mastra/fastify**: Enables running Mastra applications on Fastify
- **@mastra/koa**: Enables running Mastra applications on Koa

Both adapters provide full MastraServerBase implementation including route registration, streaming responses, multipart uploads, auth middleware, and MCP transport support.
