---
'@mastra/core': patch
---

Save correct status in snapshot for all workflow parallel steps.
This ensures when you poll workflow run result using `getWorkflowRunExecutionResult(runId)`, you get the right status for all parallel steps
