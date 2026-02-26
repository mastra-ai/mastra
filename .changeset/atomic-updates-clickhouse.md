---
'@mastra/clickhouse': patch
---

`updateWorkflowResults` and `updateWorkflowState` now throw a not-implemented error. This storage backend does not support concurrent workflow updates.
