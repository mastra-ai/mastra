---
'@mastra/core': minor
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added caller-defined dataset item identities for idempotent insertion.

Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

```ts
await dataset.addItem({
  externalId: 'source-item-123',
  input: { prompt: 'Hello' },
});
```

Retries with the same identity and payload resolve to the existing item, while incompatible reuse returns a typed conflict.
