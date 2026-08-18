---
'@mastra/core': patch
---

Fixed a cancelled durable agent run starting anyway.

Aborting a run that had not started yet, for example a turn queued behind the thread's active run, recorded the intent but never applied it: durable agents do not go through the code path that consumes it, so the run began and executed to completion after the user cancelled it. `DurableAgent.stream()`, `resume()` and `generate()` now honor that intent when they install the run's abort controller, ending the run the same way an already-aborted `abortSignal` does.

```ts
agent.abortRunStream(runId);
// then, once the queue drains:
const { output } = await agent.stream('...', { runId });
// before: the run executed normally
// after: the run aborts immediately and onAbort fires
```
