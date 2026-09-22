---
'@mastra/core': minor
---

Added root trace duration predicates to advanced trace queries.

```typescript
where: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
```
