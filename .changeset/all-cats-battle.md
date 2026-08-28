---
'@mastra/clickhouse': patch
---

Fixed trace deletion to cascade to trace branches, metrics, logs, scores, and feedback while respecting tenant scope.
