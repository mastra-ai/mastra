---
'@mastra/core': patch
---

Fixed `run.resume()`, `run.timeTravel()` and `run.restart()` on the evented workflow engine when a workflow's `id` differs from the key it is registered under in `new Mastra({ workflows })`. These runs now continue, as they do on the default engine, instead of failing with `Workflow with ID ... not found`. For example, a workflow with `id: 'approval-workflow'` registered as `approvalWorkflow` now resumes. Fixes [#29359](https://github.com/mastra-ai/mastra/issues/29359).
