---
'@mastra/pg': patch
---

Speed up `listWorkflowRuns` when filtering by `status`. On the default `jsonb` snapshot storage the status filter can now use an index instead of scanning every row, so filtered and paginated listings stay fast as run history grows. Existing `json`/`text` snapshot schemas keep working unchanged.
