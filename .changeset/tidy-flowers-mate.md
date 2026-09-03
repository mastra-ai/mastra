---
'@mastra/clickhouse': minor
---

Added ClickHouse support for filtering traces by related feedback.

```typescript
where: { feedback: { some: { op: "eq", left: { path: "feedbackSource" }, right: { literal: "clinician" } } } }
```
