---
'@mastra/clickhouse': minor
---

Added filtered span queries to ClickHouse v-next observability storage. Queries select matching span identities before loading display fields, previews, and model cost.

```typescript
const result = await observabilityStorage.querySpans(plan);
```
