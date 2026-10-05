---
'@mastra/pg': patch
---

Fixed `$exists` filters on nested metadata keys in `PgVector`. A filter like `{ 'doc.lang': { $exists: false } }` used to match every vector, and `$exists: true` matched none. Running `deleteVectors` with such a filter could delete every vector in the selected namespace. Nested `$exists` filters now match only the vectors where the key is missing or present.
