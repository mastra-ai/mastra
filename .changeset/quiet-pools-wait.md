---
'@mastra/pg': patch
---

Fixed `PgVector.createIndex()` timing out with `metadataIndexes` when the connection pool has a single connection (`pgPoolOptions: { max: 1 }`).
