---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed completed workflow runs storing their final output twice. A finished run's snapshot kept the last step's output both in the step results and again as `result`, so large `foreach` runs doubled in size and Postgres rejected them above its 256 MB `jsonb` limit. The InMemory, LibSQL and Postgres stores now save a reference to the producing step instead and rebuild `result` when the run is read, so `getWorkflowRunById`, `listWorkflowRuns` and `loadWorkflowSnapshot` return the same shape as before. Rows written by older versions still read unchanged.
