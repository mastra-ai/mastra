---
'@mastra/client-js': patch
---

Added typed item-level `scorerIds` support for creating, batch-creating, updating, reading, and inspecting dataset item versions.

```typescript
await client.addDatasetItem({
  datasetId: 'dataset-id',
  input: 'Evaluate this response',
  scorerIds: [],
});
```
