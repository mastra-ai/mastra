---
"@mastra/express": patch
"@mastra/fastify": patch
"@mastra/hono": patch
"@mastra/nestjs": patch
---

DELETE requests now honor configured body size limits and parse request bodies consistently across the Express, Fastify, Hono, and NestJS adapters.
