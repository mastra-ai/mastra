---
'@mastra/pg': patch
---

Fix PostgresStore last-N message reads scanning the whole thread. `listMessages` and `listMessagesByResourceId` now order the page query by the indexed `createdAt` column instead of `COALESCE("createdAtZ", "createdAt")`, and compute the total with a skinny scalar `COUNT(*)` subquery instead of `COUNT(*) OVER ()` (which materialized `content` for every matching row before `LIMIT`). This lets the `(thread_id, createdAt DESC)` composite index serve the LIMIT with an index scan, so recall stops after N rows instead of scanning the entire thread.
