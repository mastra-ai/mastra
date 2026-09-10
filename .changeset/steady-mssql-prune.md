---
'@mastra/mssql': minor
---

Added configurable age-based pruning for Microsoft SQL Server observability spans.

```typescript
const storage = new MSSQLStore({
  ...connection,
  retention: { observability: { spans: { maxAge: '30d' } } },
});

await storage.prune();
```
