---
'@mastra/core': patch
---

Fixed durable and evented agents losing a suspended run when an `untilIdle` stream is cancelled. Breaking out of `streamUntilIdle()` (or the request disconnecting) while the run waits for a tool approval or a `suspend()` resume now only stops reading, so `resumeStreamUntilIdle()` and `approveToolCall()` work afterwards instead of failing with "No registry entry found for run … Cannot resume". Cancelling while a tool is still running still aborts the run, and `result.abort()` still releases a suspended run.
