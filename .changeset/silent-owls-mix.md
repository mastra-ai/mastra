---
'@mastra/libsql': minor
---

Added LibSQL dataset snapshot transfer with preserved timestamps and durable retry receipts. When several `LibSQLStore` instances share one local database file and retry the same import, only one dataset is created and every retry returns its receipt.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
