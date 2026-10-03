---
'@mastra/pg': minor
---

Added atomic PostgreSQL dataset snapshot transfer with preserved item timestamps and durable retry receipts.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
