---
'@mastra/core': minor
---

Added richer `scores.some` and `scores.none` predicates for scorer versions, sources, timestamps, span anchoring, and version lineage.

```ts
where: { scores: { some: { op: "eq", left: { path: "scorerVersion" }, right: { literal: "2.1.0" } } } }
```
