---
'@mastra/core': patch
---

Fixed `mastra.shutdown()` crashing the process with an unhandled rejection when a background task was still running. Shutdown now waits, within its existing drain timeout, for running background tasks to finish cleaning up before closing storage, and a failed cleanup is logged as a warning instead of rejecting.
