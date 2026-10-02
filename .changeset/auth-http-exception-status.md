---
'@mastra/server': patch
---

Auth middleware now preserves the status and message of an `HTTPException` thrown from `authenticateToken`, so failures like an auth backend outage (503) no longer collapse into a generic 401. Other errors are still redacted to `401 Invalid or expired token`, and non-error statuses never grant access.

```ts
import { HTTPException } from '@mastra/server/server-adapter';

authenticateToken: async () => {
  throw new HTTPException(503, { message: 'Authentication service unavailable' });
};
// Response: 503 { error: 'Authentication service unavailable' }
```
