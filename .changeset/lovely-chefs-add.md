---
'@mastra/core': minor
---

Added nested scalar metadata predicates and discovery to trace queries. Segment-array paths preserve literal dots in keys and support strings, numbers, and booleans without coercion. Legacy metadata string paths retain their existing behavior.

**Example**

```ts
{ op: "gte", left: { path: ["metadata", "retry", "count"] }, right: { literal: 3 } }
```
