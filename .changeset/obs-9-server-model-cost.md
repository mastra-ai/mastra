---
'@mastra/server': minor
---

`POST /observability/traces/query` and the thread query route accept `modelCost` predicates and `orderBy: [{ field: 'modelCost' }]`. Stores without the `trace-query-model-cost` feature return a structured `501`.
