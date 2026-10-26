---
'@mastra/core': patch
---

**Fixed canceled runs that hang on tools that ignore cancellation.**

- Tools whose abort signal is already aborted no longer start.
- Running tools no longer block cancellation, even if they ignore their abort signal. Execution activity is released when cancellation settles the wait.
- Late tool results and failures are discarded without changing timeout errors.
- Eager tool results not yet recorded in the conversation may be discarded on caller cancellation, even if the tool has already returned.
- Unless the caller cancels the run, retry and fallback still wait for running eager work, record its result or error, and reuse it before the replacement attempt begins.

Already-started tool code and external side effects may continue after cancellation.
