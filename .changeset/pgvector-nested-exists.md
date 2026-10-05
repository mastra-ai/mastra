---
'@mastra/pg': patch
---

Fixed `$exists` filters on nested metadata keys in `PgVector`. Filters like `{ 'doc.lang': { $exists: false } }` previously matched every vector (and `$exists: true` matched none), so `deleteVectors` with such a filter could delete the entire index. Nested `$exists` filters now select only the rows where the path is missing or present.
