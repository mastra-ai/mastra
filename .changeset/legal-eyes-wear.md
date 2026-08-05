---
'@mastra/libsql': patch
---

Added persistence for dataset item `timeout` values, including batch inserts, updates, and historical dataset versions.

```ts
await dataset.addItem({
  input: { prompt: 'Summarize this document' },
  timeout: 5_000,
});
```
