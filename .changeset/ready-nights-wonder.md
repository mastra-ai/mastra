---
'@mastra/pg': patch
---

Added persistence for dataset item `timeout` values in PostgreSQL, including batch inserts, updates, and historical dataset versions.

```ts
await dataset.addItem({
  input: { prompt: 'Summarize this document' },
  timeout: 30_000,
});
```

PostgreSQL preserves the timeout override through updates and historical dataset versions.
