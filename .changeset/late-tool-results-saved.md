---
'@mastra/core': patch
'@mastra/inngest': patch
---

Inngest durable agents no longer block memory writes after `modelSettings.timeout.totalMs` expires. When a tool is still running at the deadline, its step is now saved to memory with the tool call. A tool that outlives the abort grace period is recorded as aborted rather than with its late return value. The run still stops with one `MastraTimeoutError` at the deadline in the process that started it; steps already running on a separate Inngest worker are not signalled. The user's message is still saved before the run starts. Durable and evented agents also save the turn at the deadline, including a step that finishes late and a user message whose save is still in flight.

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
