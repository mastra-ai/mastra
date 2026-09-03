---
'@mastra/core': minor
---

Added feedback predicates to advanced trace queries.

```typescript
where: { feedback: { some: { op: "lt", left: { path: "value" }, right: { literal: 0 } } } }
```
