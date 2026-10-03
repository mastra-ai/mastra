---
'@mastra/spanner': minor
---

Added atomic Spanner dataset snapshot transfer with preserved timestamps, durable retry receipts, and safe transaction replay after aborts.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
