---
'@mastra/client-js': minor
---

`queryTraces()` accepts `modelCost` predicates and `orderBy: [{ field: 'modelCost', direction: 'asc' | 'desc' }]`, and `tableSummary.modelCost` carries the complete USD model cost of each trace, or `null` when it is unavailable.
