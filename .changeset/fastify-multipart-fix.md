---
"@mastra/server-fastify": patch
---

Fix multipart file handling in Fastify adapter by aligning return type with other adapters and preventing stream hang on file size limit.