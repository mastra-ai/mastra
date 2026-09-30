---
'@mastra/convex': patch
---

`updateWorkflowState` now resolves to `undefined` when the workflow run has no saved snapshot, matching the other storage adapters. It previously threw `Workflow snapshot not found for runId …`, which could surface as an unhandled error during a workflow resume.
