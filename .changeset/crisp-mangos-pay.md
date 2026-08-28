---
'@mastra/core': minor
---

Added tenant-scoped trace deletion arguments for observability storage.

```typescript
await storage.batchDeleteTraces({ traceIds: ['trace-1'], organizationId: 'org-1' });
```
