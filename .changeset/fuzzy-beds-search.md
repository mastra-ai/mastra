---
'@mastra/pg': patch
---

Fixed trace deletion to cascade to metrics, logs, scores, and feedback while respecting tenant scope.
