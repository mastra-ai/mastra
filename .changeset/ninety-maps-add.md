---
'@mastra/core': patch
---

Fixed memory growth from workflow and durable agent runs that suspend and are never resumed. A suspended run is now dropped from memory once its suspension is saved to storage, and resuming it rebuilds it from the saved snapshot, in the same process or a new one. Deleting an AgentController session also releases the in-memory state of runs it left parked.

Added `durableAgent.releaseParkedRun(runId)` to drop this process's hold on a run parked at a suspension while keeping its snapshot, so it can still be resumed later.

```ts
// A host is done with a run parked on an approval, but the run may be resumed later.
const released = await durableAgent.releaseParkedRun(runId);
// false: this agent does not hold the run, it is not suspended, or a resume took it over.
```
