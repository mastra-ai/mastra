---
'@mastra/pg': patch
---

Fixed concurrent schema initialization race condition when multiple processes (e.g. API and worker containers) start simultaneously. `createTable()` and `setupSchema()` now catch duplicate-object errors (`42P07`, `42P06`, `23505` on catalog indexes) that occur when two backends race past the `IF NOT EXISTS` existence check. Shared error classifiers moved to a common location for reuse across Postgres storage domains.
