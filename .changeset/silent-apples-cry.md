---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed experimental Knowledge record rescoping to require a numeric version, preventing concurrent scope changes from overwriting newer visibility decisions.

```ts
// Before
await knowledge.setRecordScopes({ id: record.id, scopeIds });

// After: use the version of the record you read and authorized
await knowledge.setRecordScopes({ id: record.id, version: record.version, scopeIds });
```

The Subconscious rescope tool now requires `expectedVersion`. A conflict requires rereading the record and reconsidering the scope change.
