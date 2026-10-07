---
'@mastra/core': patch
---

Fixed `fetchWithRetry` ignoring cancellation. An already-aborted `signal` now rejects immediately, and aborting during a request or backoff delay stops further retries instead of waiting through the remaining delays. Retries for non-aborted requests are unchanged.
