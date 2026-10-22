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

Error responses now include a business error `code` and optional `metadata`, for example `REQUEST_BODY_TOO_LARGE`, `REQUEST_MULTIPART_INVALID`, `PERMISSION_DENIED` with `{ requiredPermissions }`, or `REQUEST_VALIDATION_FAILED` next to the validation `issues`. This covers handler errors, authentication, permission checks, body size limits, malformed JSON or multipart bodies and validation failures. Codes are listed in `@mastra/server/error-codes`.

```ts
import { SERVER_ERROR_CODES } from '@mastra/server/error-codes';

const res = await fetch('/api/agents/support-agent/generate', { method: 'POST', body });
const error = await res.json();

if (error.code === SERVER_ERROR_CODES.PERMISSION_DENIED) {
  console.log('Missing permissions', error.metadata?.requiredPermissions);
}
```

In `@mastra/nestjs`, `code` previously held a value derived from the HTTP status (for example `BAD_REQUEST` or `INTERNAL_ERROR`). It now holds the business code; use the response status for the HTTP category.
