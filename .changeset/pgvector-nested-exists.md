---
'@mastra/pg': patch
---

Fixed `$exists` filters on nested metadata keys in `PgVector`. A filter like `{ 'doc.lang': { $exists: false } }` used to match every vector, and `$exists: true` matched none. Running `deleteVectors` with such a filter could delete every vector in the selected namespace. Now `$exists: true` matches vectors where the nested key is present, and `$exists: false` matches vectors where it is missing.
