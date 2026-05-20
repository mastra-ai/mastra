---
"@mastra/core": minor
---

Harness sessions can now be reliably resumed from scheduled or proactive triggers, even after server restarts.

Server restarts and interrupted shutdowns no longer leave duplicate Harness wakeup workers running.

```ts
import { Mastra } from '@mastra/core';

new Mastra({
  harnesses: { default: harness },
  storage,
  harnessWakeups: { pollIntervalMs: 1_000 },
});
```
