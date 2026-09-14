---
'@mastra/server': minor
---

Added an authenticated thread-query endpoint with capability checks and structured query errors.

```http
POST /observability/threads/query
```

The endpoint accepts eligible trace and cross-trace predicates and returns thread identities with cursor pagination.
