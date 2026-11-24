---
'@mastra/client-js': minor
---

Added `durable`, `itemTimeout` and `maxRetries` to `triggerDatasetExperiment()`.

```typescript
await client.triggerDatasetExperiment({
  datasetId,
  targetType: 'agent',
  targetId: 'support-agent',
  durable: true,
  itemTimeout: 30_000,
  maxRetries: 1,
});
```
