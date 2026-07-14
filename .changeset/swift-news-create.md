---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added caller-defined dataset item identities for safe retries across all dataset storage adapters.

Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

```ts
await dataset.addItem({
  externalId: 'source-item-123',
  input: { prompt: 'Hello' },
});
```

Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.
