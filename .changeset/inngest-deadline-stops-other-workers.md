---
'@mastra/inngest': patch
---

On Inngest, the deadline now stops a step running on another worker. Before, only the caller's local controller was aborted, so the other worker kept going and the run could call the model again and finish normally. `abort()` now also stops the run when its next step lands on a different worker.

The deadline also reaches a worker that first sees the run after it passed, so that worker stops instead of calling the model. If no worker reports within a few seconds of the deadline, the caller saves the turn itself (output processors and memory) before reporting the timeout.

Errors with the id `DURABLE_AGENT_EXECUTION_TIMED_OUT` are no longer thrown, because Inngest durable agents no longer refuse memory writes after the deadline. Remove any checks for that id. The deadline is still reported as a `MastraTimeoutError`.

```ts
// Before
if (error.id === 'DURABLE_AGENT_EXECUTION_TIMED_OUT') {
  // handle the deadline
}

// After
import { isMastraTimeoutError } from '@mastra/core/loop';

if (isMastraTimeoutError(error)) {
  // handle the deadline
}
```
