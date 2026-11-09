---
'@mastra/core': patch
'@mastra/inngest': patch
---

Export `AgentStreamBus`, `createRunAbortController`, and the `RunAbortController` type from `@mastra/core/agent/durable` for shared stream-bus and caller-cancellation setup.

```ts
import { AgentStreamBus, createRunAbortController, type RunAbortController } from '@mastra/core/agent/durable';
```

Plain, durable, and Inngest agents share caller-abort forwarding. Inngest reuses core's stream-bus setup. Existing stream delivery and cleanup policies are preserved.
