---
'@mastra/core': minor
---

Added tenant-scoped trace deletion arguments for observability storage with a limit of 1,000 trace IDs per batch.

```typescript
await storage.batchDeleteTraces({ traceIds: ['trace-1'], organizationId: 'org-1' });
```
