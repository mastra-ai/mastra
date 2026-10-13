---
'@mastra/playground-ui': patch
---

Fixed Studio showing a workflow run as Suspended and asking for approval again after the run was resumed from code or the API (for example `run.resume()` or `POST /workflows/:workflowId/resume-async`). Studio now shows the run as running with the approved step completed.
