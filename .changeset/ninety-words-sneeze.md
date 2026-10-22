---
'@mastra/server': minor
---

Added business error codes to every JSON error response. Each error body now includes a stable `code` (for example `AGENT_NOT_FOUND`) and optional `metadata` with the values needed to describe the failure. Existing fields such as `error` and `issues` are unchanged.

```json
{
  "error": "Agent with id support-agent not found",
  "code": "AGENT_NOT_FOUND",
  "metadata": { "agentId": "support-agent" }
}
```

The full list of codes is exported from the new dependency-free `@mastra/server/error-codes` entry point, so frontends can branch on errors without parsing messages:

```ts
import { SERVER_ERROR_CODES, getServerErrorInfo } from '@mastra/server/error-codes';

const info = getServerErrorInfo(body);
if (info?.code === SERVER_ERROR_CODES.AGENT_NOT_FOUND) {
  // show a "missing agent" message
}
```

**Setting a code from custom routes**

`HTTPException` from `@mastra/server/server-adapter` accepts an optional `code` from the catalog and optional `metadata`, exposed as `error.code` and `error.metadata`. Existing calls keep working.

```ts
throw new HTTPException(404, { message: 'Agent not found', code: 'AGENT_NOT_FOUND', metadata: { agentId } });
```

Errors thrown with an HTTP status but no code (for example Hono's `HTTPException`, or an error with a `status` property) get `UNCATEGORIZED_ERROR` and keep their status. `UNEXPECTED_ERROR` is reserved for errors without a status. Custom routes now keep the status of the errors they throw instead of always returning 500. Server logs still record every custom-route error except 4xx client errors.

**Custom adapters**

`ParsedRequestParams.bodyParseError` accepts an optional `code`, so adapters can report `REQUEST_MULTIPART_INVALID` for multipart failures. Without one, `REQUEST_BODY_INVALID_JSON` is used.
