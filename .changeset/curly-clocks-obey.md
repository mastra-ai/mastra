---
'@mastra/factory': patch
---

Fixed retrying a failed Factory run after its work item moved to another phase. The retry is now refused (`canRetry: false` and a 409 `decision_not_retryable`), and a stale run already in the queue settles as superseded instead of starting a session for the old role and reporting success.
