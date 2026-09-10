---
'@mastra/mysql': minor
---

Added configurable age-based pruning for MySQL observability spans.

```typescript
const storage = new MySQLStore({
  ...connection,
  retention: { observability: { spans: { maxAge: '30d' } } },
});

await storage.prune();
```
