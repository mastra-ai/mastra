---
'@mastra/fastify': patch
---

Fix multipart upload tests to register the multipart content-type parser. The tests were manually adding the preHandler hook but skipping `registerContextMiddleware()`, which meant Fastify rejected `multipart/form-data` requests with 415 Unsupported Media Type.
