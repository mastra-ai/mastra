---
'@mastra/pg': minor
---

Added PostgreSQL support for filtering traces by related feedback.

```typescript
where: { feedback: { none: { op: "eq", left: { path: "feedbackType" }, right: { literal: "clinical-review" } } } }
```
