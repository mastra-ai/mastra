---
'@mastra/core': patch
---

Fixed background tasks that finish after their run ended going unreported or reported twice:

- The agent woken to report a finished task now uses the request context of the run that dispatched it, so a model, instructions, or memory resolved from that context no longer fail.
- A finished task is now reported once another agent's run on the same thread ends, for example after it waits for a tool approval, instead of being dropped.
- A stored version of a durable agent no longer reports a finished task twice while an `untilIdle` stream is open.
- A task is still reported when a newer `untilIdle` stream on the thread takes over and can't track it, instead of being treated as stopped by the caller.
