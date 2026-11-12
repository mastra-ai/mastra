---
'@mastra/mongodb': patch
---

Listing workflow runs with `summary: true` now returns only each run's `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }` (#28712). MongoDB sends only these fields, so listing many runs no longer transfers their full snapshots.
