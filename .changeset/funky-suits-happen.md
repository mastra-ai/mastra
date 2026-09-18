---
'@mastra/core': minor
---

Added portable dataset export, destination preflight, and atomic import into a new dataset. Transfers preserve item timestamps and portable identities instead of recreating them through ordinary item insertion. Reuse the same request key to recover its original outcome.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const report = await destination.datasets.preflightSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'release-1',
});
const result = await destination.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'release-1',
});
```
