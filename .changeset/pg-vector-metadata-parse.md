---
'@mastra/pg': patch
---

Fixed `PgVector.query()` with a filter only and `includeVector: true` on `bit` and `sparsevec` indexes. It threw a `SyntaxError` or returned a single number; it now returns the stored embedding as a `number[]`, the same as vector-similarity queries.
