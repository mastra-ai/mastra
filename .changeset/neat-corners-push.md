---
'@mastra/core': minor
---

Added metadata filtering to score queries. You can now filter scores by metadata key-value pairs when listing scores:

```typescript
const result = await storage.listScores({
  filters: { metadata: { env: 'prod' } },
});
```
