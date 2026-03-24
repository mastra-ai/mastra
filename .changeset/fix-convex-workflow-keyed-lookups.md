---
'@mastra/convex': patch
---

Fixed workflow query performance in Convex storage

Workflow snapshot queries (`getWorkflowRunById`, `listWorkflowRuns`) now use indexed lookups and server-side filtering instead of fetching all rows. This significantly improves performance for deployments with large workflow histories and avoids hitting Convex's 16MB read limit with growing datasets.
