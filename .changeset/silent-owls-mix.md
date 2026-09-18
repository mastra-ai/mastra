---
'@mastra/libsql': minor
---

Added LibSQL dataset snapshot transfer with preserved timestamps and durable retry receipts. Independent `LibSQLStore` instances sharing one local database file arbitrate same-key imports through the SQLite write lock.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
