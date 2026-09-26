---
'@mastra/mysql': minor
---

Added atomic MySQL dataset snapshot transfer with preserved timestamps and retry receipts. Preflight rejects unsupported item tool mocks before writing data.

```ts
const snapshot = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
const result = await mastra.datasets.importSnapshot({
  snapshot: JSON.stringify(snapshot),
  idempotencyKey: 'copy-1',
});
```
