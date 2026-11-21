---
'@mastra/core': minor
---

Fixed memory growth when an AgentController session is deleted while a durable agent run is parked at a suspension. Deleting the session now frees the run's in-memory state and deletes its stored snapshot, so the run can no longer be resumed.

Added `durableAgent.releaseParkedRun(runId)` to drop this process's hold on a run parked at a suspension while keeping its snapshot, so it can still be resumed later.

```ts
// A host is done with a run parked on an approval, but the run may be resumed later.
const released = await durableAgent.releaseParkedRun(runId);
// false: this agent does not hold the run, it is not suspended, or a resume took it over.
```
