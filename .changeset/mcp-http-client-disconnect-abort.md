---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/elysia': patch
'@mastra/next': patch
---

Fixed MCP tool calls continuing to run after the client disconnects on the Hono, Elysia and Next adapters. Closing the connection during an in-flight `tools/call` over Streamable HTTP now fires the tool's `abortSignal` right away, matching Express, Fastify, Koa and NestJS. Previously the signal only fired after the tool had finished.
