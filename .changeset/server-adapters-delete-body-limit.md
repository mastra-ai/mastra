---
"@mastra/express": patch
"@mastra/fastify": patch
"@mastra/hono": patch
"@mastra/nestjs": patch
---

DELETE requests, including those handled by ALL routes, now honor configured body size limits and parse request bodies consistently across the Express, Fastify, Hono, and NestJS adapters.
