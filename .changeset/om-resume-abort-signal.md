---
'@mastra/memory': patch
---

Fixed resuming a suspended durable agent run with observational memory after the first request's abort signal was aborted. The resume no longer fails with "This operation was aborted"; observational memory now follows the abort signal of the call that is currently running.
