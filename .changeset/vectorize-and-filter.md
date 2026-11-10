---
'@mastra/vectorize': patch
---

Fixed semantic recall filters on Cloudflare Vectorize. Mastra combines the recall scope with your filter as `{ $and: [...] }`, which the Vectorize translator rejected, so `memory.recall()` with a filter threw a query error. Agent runs now send the same combined filter for `semanticRecall.filter`, so they needed this too. A top-level `$and` is now merged into one Vectorize filter. A condition repeated with the same value is merged once. Different conditions on one field are merged only as one lower and one upper bound, which Vectorize supports; other combinations on one field, and clauses that aren't filter objects, throw.
