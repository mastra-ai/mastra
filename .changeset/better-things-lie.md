---
'@mastra/core': patch
---

Fixed background tasks failing to resume when the suspended tool was a sub-agent or a nested workflow.

When an agent delegates to a sub-agent as a background task and that nested run suspends — for example to ask for human approval — resuming the task now continues the suspended sub-agent instead of losing track of it.

**What was wrong**

The nested run's id was handed to the background task at suspend time but never persisted, and the task's original arguments are frozen at dispatch. On resume the delegation was therefore re-invoked without it, so it could not find the suspended run. This surfaced either as an `AGENT_RESUME_NO_SNAPSHOT_FOUND` error raised once retries were exhausted, or as the sub-agent silently starting over from the beginning.

```ts
const { task } = await manager.enqueue(payload, context);
// the sub-agent suspends, waiting for approval...

await manager.resume(task.id, { approved: true });
// before: the sub-agent started from scratch, or the task failed after retries
// after:  the suspended sub-agent run resumes where it left off
```

Background tools that suspend on their own — anything that is not a delegation — are unaffected, and the run id is kept out of the task's `suspendPayload` so it does not appear on `task.suspended` events.
