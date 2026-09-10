---
'@mastra/dsql': minor
---

Added configurable age-based pruning for Amazon Aurora DSQL observability spans.

```typescript
const storage = new DSQLStore({
  ...connection,
  retention: { observability: { spans: { maxAge: '30d' } } },
});

await storage.prune();
```
