---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Route server errors through Mastra logger instead of console.error

Server adapter errors (handler errors, parsing errors, auth errors) now use the configured Mastra logger instead of console.error. This ensures errors are properly  
formatted as structured logs and sent to configured transports like HttpTransport.
