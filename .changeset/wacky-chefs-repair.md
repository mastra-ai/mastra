---
'@mastra/pg': patch
---

Fixed `PgVector` calls failing with "Vector table ... does not exist" when an index was deleted and recreated right after the store was created. The store no longer caches what its startup check saw for an index that was deleted or rebuilt while that check was still running.
