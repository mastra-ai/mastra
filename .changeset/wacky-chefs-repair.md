---
'@mastra/pg': patch
---

Fixed `PgVector` calls failing with "Vector table ... does not exist" after an index was deleted and created again while a new `PgVector` instance was still starting up. Also fixed `createIndex()` keeping the previous metric when an index was recreated during that time.
