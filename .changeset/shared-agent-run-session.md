---
'@mastra/core': patch
---

Export `AgentStreamBus`, `createRunAbortController`, and the `RunAbortController` type from `@mastra/core/agent/durable` for shared stream-bus and caller-cancellation setup.

```ts
import { AgentStreamBus, createRunAbortController, type RunAbortController } from '@mastra/core/agent/durable';

const caller = new AbortController();
const run: RunAbortController = createRunAbortController(caller.signal);
caller.abort(new Error('Stop this run'));
console.log(run.controller.signal.aborted); // true
run.detach();
```

Plain and durable agents share caller-abort forwarding. Existing stream delivery and cleanup policies are preserved.
