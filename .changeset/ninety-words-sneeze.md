---
'@mastra/server': minor
---

Added business error codes to every JSON error response. Each error body now includes a `problem` object with a stable `code` (for example `AGENT_NOT_FOUND`) and optional `metadata` with the values needed to describe the failure. Existing fields such as `error` and `issues` are unchanged.

```json
{
  "error": "Agent with id support-agent not found",
  "problem": { "code": "AGENT_NOT_FOUND", "metadata": { "agentId": "support-agent" } }
}
```

The full list of codes is exported from the new dependency-free `@mastra/server/error-codes` entry point, so frontends can branch on errors without parsing messages:

```ts
import { SERVER_ERROR_CODES, isServerProblem } from '@mastra/server/error-codes';

if (isServerProblem(body.problem) && body.problem.code === SERVER_ERROR_CODES.AGENT_NOT_FOUND) {
  // show a "missing agent" message
}
```

**Required `code` on `HTTPException`**

`HTTPException` from `@mastra/server/server-adapter` now requires a `code` from the catalog, and accepts optional `metadata`. Update custom routes that throw it:

```ts
// Before
throw new HTTPException(404, { message: 'Agent not found' });

// After
throw new HTTPException(404, { message: 'Agent not found', code: 'AGENT_NOT_FOUND', metadata: { agentId } });
```
