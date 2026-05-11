---
'@mastra/core': patch
---

Added validation to evented workflows to ensure execution prerequisites are met. `EventedWorkflow.createRun()` now throw clear error messages when the workflow execution flow is empty (missing `.then()`, `.branch()`, etc. calls) or when the step graph has uncommitted changes (missing `.commit()` call). This catches configuration errors early rather than failing during execution.
