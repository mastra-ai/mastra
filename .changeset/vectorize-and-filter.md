---
'@mastra/vectorize': patch
---

Fixed `semanticRecall.filter` and `memory.recall()` filters failing on Cloudflare Vectorize. Mastra combines the recall scope with your filter as `{ $and: [...] }`, which Vectorize rejected, so recall returned nothing. A top-level `$and` is now merged into one Vectorize filter. Several conditions on one field are merged only as one lower and one upper bound, which Vectorize supports; other combinations on one field, and clauses that aren't filter objects, throw.
