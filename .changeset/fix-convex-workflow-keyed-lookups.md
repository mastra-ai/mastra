---
'@mastra/convex': patch
---

fix(convex): use keyed lookups for workflow snapshot queries instead of full table scans

- `getWorkflowRunById`: uses `load()` with composite keys when `workflowName` is provided (O(1)), falls back to filtered `queryTable` when omitted
- `getRun`: uses `load()` with composite keys (both params required)
- `listWorkflowRuns`: passes `workflowName`/`resourceId` as server-side filters instead of fetching all rows and filtering in JavaScript
