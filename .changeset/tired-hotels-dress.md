---
'@mastra/pg': minor
---

Added PostgreSQL support for richer score predicates in advanced trace queries.

```ts
where: { scores: { some: { op: "exists", path: "spanId" } } }
```
