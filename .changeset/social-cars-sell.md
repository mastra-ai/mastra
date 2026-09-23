---
'@mastra/server': minor
---

Added capability-aware routing for trace-level root duration predicates.

Previously, duration filtering used the existing span relation, which remains available on older adapters and can match a child span:

```typescript
where: {
  spans: {
    some: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
  }
}
```

Stores that advertise root duration support now accept the top-level field, while older stores return a structured unsupported response and omit the field from trace discovery:

```typescript
where: { op: "gt", left: { path: "durationMs" }, right: { literal: 5000 } }
```
