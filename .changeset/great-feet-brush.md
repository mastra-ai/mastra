---
'@mastra/pg': minor
---

Added namespace isolation to PgVector operations so applications can safely reuse vector indexes across tenants. Existing vectors remain available in the default namespace.

```ts
await pgVector.upsert({
  indexName: 'documents',
  vectors,
  ids,
  namespace: 'tenant-123',
});

const results = await pgVector.query({
  indexName: 'documents',
  queryVector,
  namespace: 'tenant-123',
});
```
