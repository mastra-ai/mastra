---
'@mastra/core': patch
---

fix(fetchWithRetry): skip retry on 4xx client errors

The `fetchWithRetry` utility in `utils.ts` previously retried on all non-2xx
responses, including 4xx client errors (400, 401, 403, 404, 422, etc.).
Client errors are not retryable — the request itself is invalid and retrying
will not change the server's response.

This aligns the `utils.ts` implementation with the existing correct behaviour
in `utils/fetchWithRetry.ts`, where 4xx responses are thrown immediately
without retry.
