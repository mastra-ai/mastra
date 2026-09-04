---
'@mastra/client-js': minor
---

Added `deleteTraces()` to delete traces and their linked observability signals.

```typescript
await mastraClient.deleteTraces({ traceIds: ['trace-1'] });
```
