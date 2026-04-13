---
'@mastra/pg': patch
---

Fixed `batchInsert` and `batchUpdate` in `@mastra/pg` to run on a single Postgres transaction connection.

This prevents pooled `BEGIN`/`COMMIT`/`ROLLBACK` calls from landing on different connections and leaving idle transactions open during batch writes.
