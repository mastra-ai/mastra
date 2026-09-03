---
'@mastra/pg': minor
---

Added PostgreSQL support for parameterized top-level metadata predicates in advanced trace queries.

```ts
where: { op: "in", value: { path: "metadata.actorRole" }, set: ["assistant", "tool"] }
```
