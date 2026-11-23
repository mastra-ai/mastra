---
'@mastra/core': minor
---

Fixed memory growth when an AgentController session is deleted while a durable agent run is parked at a suspension. Deleting the session now also frees the run's in-memory state in this process, not just its stored snapshot. A run that a resume has already taken over in this process keeps its snapshot, and the snapshot is now also deleted under the loop workflow name a durable engine such as Inngest advertises.

Added `durableAgent.releaseParkedRun(runId)` to drop this process's hold on a run parked at a suspension while keeping its snapshot, so it can still be resumed later.

```ts
// A host is done with a run parked on an approval, but the run may be resumed later.
const released = await durableAgent.releaseParkedRun(runId);
// false: this agent does not hold the run, it is not suspended, or a resume took it over.
// It rejects if the run's snapshot can't be read (nothing is released), or if releasing one of
// the run's streams throws (the rest is still released).
```
