---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Dataset, dataset item, experiment and experiment result listings now honor the `orderBy` option instead of always returning a fixed order. This requires `@mastra/core` 1.68.0 or newer.
