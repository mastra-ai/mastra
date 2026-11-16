---
'@mastra/pg': patch
---

Fixed `PgVector` calls failing with "Vector table ... does not exist" after an index was deleted with `deleteIndex()` and created again while that `PgVector` instance was still starting up. Also fixed `createIndex()` on that instance keeping the previous metric when the index was deleted and recreated, or rebuilt, during that time.
