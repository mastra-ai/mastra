---
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
'@mastra/deployer': patch
---

Error responses now include a `problem` object with a business error `code` and optional `metadata`, for example `REQUEST_BODY_TOO_LARGE` with `{ maxBodySize }`, `PERMISSION_DENIED` with `{ requiredPermissions }`, or `REQUEST_VALIDATION_FAILED` with the validation issues. This covers handler errors, authentication, permission checks, body size limits, malformed JSON and validation failures. Codes are listed in `@mastra/server/error-codes`.
