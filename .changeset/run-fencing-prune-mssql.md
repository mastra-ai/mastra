---
'@mastra/mssql': patch
---

`storage.prune()` now deletes durable agent run fencing records. Configure `retention.workflows.runOwnership` (by inactivity) and `retention.memory.runFences` (by time since retirement) to stop keeping one claim and one fence record per run forever. Fences of running executions are never pruned.
