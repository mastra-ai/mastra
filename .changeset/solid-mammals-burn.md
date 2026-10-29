---
'@mastra/core': patch
---

Fixed `mastra.shutdown()` crashing the process with an unhandled rejection when background tasks were still active.

- Shutdown now waits, within its existing drain timeout, for running background tasks to finish cleaning up before closing storage.
- Failed run cleanup and failed periodic task cleanup are logged as warnings instead of rejecting.
- A background task being resumed when shutdown starts now stays `suspended`, so it can be resumed again, instead of being left `running` and later restarted from scratch.
