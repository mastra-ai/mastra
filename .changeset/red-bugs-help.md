---
'@mastra/mongodb': minor
---

Added atomic MongoDB dataset snapshot transfer with preserved timestamps and retry receipts. Transfers require transaction support and reject snapshots of datasets whose deletion is incomplete.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
