---
"@mastra/core": minor
"@mastra/libsql": patch
"@mastra/pg": patch
---

Harness sessions can now be reliably resumed from scheduled or proactive triggers, even after server restarts.

LibSQL and PostgreSQL wakeup ledgers now preserve `yolo` queue-admission overrides during durable wakeup recovery.

PostgreSQL storage now imports and includes the favorites domain in schema export, so store initialization and exported DDL include favorites consistently.

```ts
import { Mastra } from '@mastra/core';

new Mastra({
  harnesses: { default: harness },
  storage,
  harnessWakeups: { pollIntervalMs: 1_000 },
});
```
