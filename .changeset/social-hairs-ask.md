---
'@mastra/core': patch
---

**Fixed canceled runs that hang on tools that ignore cancellation.**

- Tools whose abort signal is already aborted no longer start.
- Cancellation gives running tool executions a 250 ms grace period to settle and keeps successful results completed within that window across eager, deferred, and durable execution.
- Tools still running after the window remain incomplete. Execution activity is released, and later results and failures are ignored without changing timeout errors.
- Unless the caller cancels the run, retry and fallback still wait for running eager work, record its result or error, and reuse it before the replacement attempt begins.

Already-started tool code and external side effects may continue after cancellation.
