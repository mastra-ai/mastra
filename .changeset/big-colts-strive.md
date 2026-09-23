---
'@mastra/core': patch
---

Fixed delayed workflow result writes from a deleted run lifetime merging stale step output into a reopened lifetime's snapshot. Evented `updateWorkflowResults` callsites now carry the run's `executionGeneration`, and the in-memory workflow store compares it against the stored snapshot's lineage before merging — a stale-lifetime write gets the no-merge result. Storage adapters that do not yet compare the forwarded generation ignore it.
