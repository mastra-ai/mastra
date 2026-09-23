---
'@mastra/duckdb': minor
---

Added DuckDB support for filtering completed root traces by elapsed duration.

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
