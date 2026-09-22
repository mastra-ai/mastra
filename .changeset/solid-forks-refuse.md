---
'@mastra/clickhouse': minor
---

Added ClickHouse support for filtering completed root traces by elapsed duration.

```typescript
where: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
```
