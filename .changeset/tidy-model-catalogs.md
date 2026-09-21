---
'@mastra/core': patch
---

Fixed model catalogs to respect gateway ownership and check each model's credentials independently. Controller lists now include newly registered gateways, and a list started before invalidation cannot replace a newer cached result.
