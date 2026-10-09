---
'@mastra/core': patch
---

Fixed durable agent threads staying busy forever when a run's stream never received a terminal event. This happened when `cleanup()` was called before the run ended, or when the run's FINISH/ERROR event was dropped (for example after a provider connection error). `getActiveThreadRunId()` stayed set, queued messages never ran, and `onFinish`/`onError` never fired until the process restarted. The thread is now released and the stream ends with an error once the run finishes.
