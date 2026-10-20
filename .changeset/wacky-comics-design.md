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

Error responses now include a `problem` object with a business error `code` and optional `metadata`, for example `REQUEST_BODY_TOO_LARGE`, `REQUEST_MULTIPART_INVALID`, `PERMISSION_DENIED` with `{ requiredPermissions }`, or `REQUEST_VALIDATION_FAILED` with the validation issues. This covers handler errors, authentication, permission checks, body size limits, malformed JSON or multipart bodies and validation failures. Codes are listed in `@mastra/server/error-codes`.

```ts
import { SERVER_ERROR_CODES, isServerProblem } from '@mastra/server/error-codes';

const res = await fetch('/api/agents/support-agent/generate', { method: 'POST', body });
const { problem } = await res.json();

if (isServerProblem(problem) && problem.code === SERVER_ERROR_CODES.PERMISSION_DENIED) {
  console.log('Missing permissions', problem.metadata?.requiredPermissions);
}
```
