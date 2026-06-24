---
'@mastra/core': patch
---

Fixed follow-up messages being lost after interrupting a stream. When a user aborted a run (e.g. Ctrl+C) and then immediately sent a new message, the follow-up never received a response.

Two issues were addressed in the harness session:

- When an aborted run terminated the subscribed-thread consumer loop, the live subscription was left attached but no longer drained. A follow-up signal would start a new run on that subscription, but its chunks were never processed. The run engine now detaches the subscription when the consumer loop breaks on abort, so the next signal re-subscribes and starts a fresh consumer.
- `Session.sendSignal` could dispatch a signal onto the dying run because `abort()` clears the `AbortController` immediately while the run id and active-run id linger until `run.reset()` runs after `agent_end`. `sendSignal` now detects the post-abort window (an abort was requested but the run has not reset) and waits for the stream to fully idle before starting a new run.
