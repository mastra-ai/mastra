---
'@mastra/dsql': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
---

Added configurable age-based pruning for observability spans. Set `retention.observability.spans.maxAge` when constructing the storage adapter, then run pruning when appropriate for your application.

```typescript
await storage.prune();
```
