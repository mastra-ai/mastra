---
'@mastra/dynamodb': patch
---

Listing workflow runs with `summary: true` now returns only each run's `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }`, so callers that only need run metadata no longer receive full snapshots (#28712). DynamoDB still reads whole snapshots and reduces them before returning.
