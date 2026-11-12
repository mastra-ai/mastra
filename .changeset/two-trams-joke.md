---
'@mastra/pg': patch
---

Listing workflow runs with `summary: true` now also returns `parentWorkflow: { workflowId, runId }` for nested runs, next to `status` and `timestamp` (#28712). PostgreSQL still sends only these fields, so listing many runs doesn't transfer their full snapshots.
