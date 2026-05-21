---
'@mastra/core': patch
---

Added `Mastra.init()` as a Harness readiness lifecycle so callers can wait for channels and Harness initialization before accepting traffic or starting workers.

Callers that start workers directly should initialize Mastra first:

```ts
const mastra = new Mastra({ harness });
await mastra.init();
await mastra.startWorkers();
```

Harness readiness means every registered Harness instance has completed its async initialization and is safe to accept traffic.
