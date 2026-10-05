---
'@mastra/pg': minor
---

Added filtered span queries to PostgreSQL v-next observability storage with stable pagination, previews, and model cost.

```typescript
const result = await observabilityStorage.querySpans(plan);
```
