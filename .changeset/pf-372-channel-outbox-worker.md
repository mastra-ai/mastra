---
"@mastra/core": patch
---

Added a `HarnessChannelOutboxWorker` that periodically dispatches durable Harness channel outbox rows through the existing Harness channel runtime.

Mastra now auto-registers the worker for Harness instances with configured channel bindings and storage, while leaving channel claim, retry, and provider delivery semantics inside `harness.channels.dispatchOutbox()`.

```ts
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  harnessChannelOutbox: {
    enabled: true,
    pollIntervalMs: 30_000,
    batchSize: 100,
  },
});
```
