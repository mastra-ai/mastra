---
'@mastra/core': patch
---

Fixed `run.resume()`, `run.timeTravel()` and `run.restart()` on the evented workflow engine throwing `Workflow with ID ... not found` when a workflow's `id` differs from the key it is registered under in `new Mastra({ workflows })`, for example `id: 'approval-workflow'` registered as `approvalWorkflow`. These runs now continue as they do on the default engine. Fixes #29359.
