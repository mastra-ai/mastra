---
'@mastra/core': patch
---

Fixed `run.stream()` on the evented workflow engine reporting `workflow-finish` with `workflowStatus: 'success'` when the run failed. The evented engine now emits the failed step's `workflow-step-result` before finishing, matching the default engine, so stream consumers and UIs see `failed`.
