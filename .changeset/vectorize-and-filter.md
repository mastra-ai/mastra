---
'@mastra/vectorize': patch
---

Fixed `semanticRecall.filter` and `memory.recall()` filters failing on Cloudflare Vectorize. Mastra combines the recall scope with your filter as `{ $and: [...] }`, which Vectorize rejected, so recall returned nothing. A top-level `$and` is now merged into one Vectorize filter. Clauses that set the same operator on the same field still throw, because Vectorize can't express them.
