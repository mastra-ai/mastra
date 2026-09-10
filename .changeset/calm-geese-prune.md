---
'@mastra/core': minor
---

Added consistent, resumable `prune()` execution for storage adapters, including bounded work, pause intervals, and cancellation.

```ts
const controller = new AbortController();

await storage.prune({
  maxBatches: 10,
  maxRows: 10_000,
  pauseMs: 25,
  signal: controller.signal,
});
```
