---
'@mastra/core': patch
'@mastra/inngest': patch
---

Agent runs that hit `modelSettings.timeout.totalMs` now save their work to memory on every engine (default, filesystem, durable, evented and Inngest). Completed steps are saved at the deadline even when `savePerStep` is off. A tool still running at the deadline gets the abort grace period to stop. Its step is then saved with the tool call and an abort notice instead of the late return value. Memory output processors run on this save, so observational memory and custom history stores see the turn too. The user's message is saved even if its save was still in flight when the deadline hit.

The caller still sees exactly one `MastraTimeoutError`. It is delayed until the save lands, but by at most one second, so a stuck memory store cannot hold the error back.

On Inngest, the deadline now stops a step running on another worker. Before, only the caller's local controller was aborted, so the other worker kept going and the run could call the model again and finish normally. `abort()` now also stops the run when its next step lands on a different worker.

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
