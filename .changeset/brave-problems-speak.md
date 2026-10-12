---
'@mastra/server': minor
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

Added an optional `problem` field to server error responses, following RFC 9457 Problem Details. The existing `error` field and the `application/json` content type are unchanged, so current clients keep working.

`problem.code` carries a business error code such as `AGENT_NOT_FOUND`, `THREAD_ACCESS_DENIED`, or `DURABLE_RUN_ACTIVE`, while the HTTP status stays the generic category. For 5xx errors, `detail` is omitted so internal messages aren't exposed.

The new `@mastra/server/http-errors` entry point exports the Zod schema, the `ProblemDetails` type, and the error code catalogue. It depends only on `zod`, so you can use it in client code:

```typescript
import { problemDetailsSchema } from '@mastra/server/http-errors';

const { problem } = await response.json();
const parsed = problemDetailsSchema.safeParse(problem);
if (parsed.success && parsed.data.code === 'AGENT_NOT_FOUND') {
  // handle missing agent
}
```
