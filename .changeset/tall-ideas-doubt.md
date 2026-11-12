---
'@mastra/core': patch
---

The in-memory store now honors `summary: true` in `listWorkflowRuns()`: each run's snapshot comes back as only `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }`, so large snapshots aren't copied (#28712). It also updates a run's `updatedAt` on every write, including `updateWorkflowResults()` and `updateWorkflowState()`, as the database adapters do.
