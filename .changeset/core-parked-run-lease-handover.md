---
'@mastra/core': patch
---

Fixed a durable agent run resumed on another process being aborted by the process that started it, when the agent has `Memory`. A run parked on a tool suspension (`ask_user`, a tool approval, any `suspend()`) keeps renewing its thread lease in the process that parked it — that hold is what queues later messages onto the suspension instead of starting a second run beside it. When a resume on another process registered the same run id and took that lease under its own owner, the parked process read the takeover as a lost lease and published an abort for the run id, which reaches the process executing the resume and ends its stream with an `abort` chunk a few seconds in, with no error to the caller.

A parked run with nothing left running has no step to stop, so it now steps its record aside when the thread moves on, the same way it already does for a thread a different run ran to an end: the record keeps its suspended state and stays resumable, and the resume that took over runs to completion. A run that is still executing — one resumed part-way, or one whose step outlived the segment that raised the suspension — is stopped instead, so it cannot keep working beside the thread's new owner. Fixes [#29974](https://github.com/mastra-ai/mastra/issues/29974).
