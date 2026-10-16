---
'@mastra/libsql': patch
---

Fixed `LibSQLStore` startup failing against remote databases (e.g. Turso) when a single request hit a transient network error such as `fetch failed`. Remote domain initialization now runs at most 5 domains at a time, retries transient network errors with backoff, and a failed `init()` can be retried instead of re-throwing the cached error.
