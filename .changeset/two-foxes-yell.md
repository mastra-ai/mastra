---
'@mastra/core': minor
---

Added trace-level `durationMs` predicates to advanced trace queries.

Previously, duration filtering required a span relation, which can match a child span:

```typescript
where: {
  spans: {
    some: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
  }
}
```

Use the top-level field to evaluate only the selected completed root:

```typescript
where: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
```
