---
'@mastra/core': patch
---

Documented two `aggregateTraces()` result rules: null dimension values sort last in both sort directions, and a time range with no matching traces returns `rows: []` rather than a single zero-valued row.
