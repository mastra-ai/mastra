---
'@mastra/libsql': patch
---

Fixed `LibSQLStore` crashing on startup against remote databases (e.g. Turso) when a request hit a transient network error like `fetch failed`. Domain initialization now runs at most 5 domains at a time and retries transient network errors with backoff. A failed `init()` can now be retried.
