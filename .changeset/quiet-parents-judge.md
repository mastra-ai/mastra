---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `$or` and `$nor` metadata filters treating the keys of one condition as alternatives. A filter like `{ $or: [{ category: 'electronics', inStock: true }, { name: 'novel' }] }` also matched out-of-stock electronics, and `deleteVectors` with such a filter deleted more vectors than intended. The keys of each condition are now combined with AND.
