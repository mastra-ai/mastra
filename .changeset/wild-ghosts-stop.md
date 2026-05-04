---
'@mastra/clickhouse': minor
---

- **Added** `listBranches` and `getSpans` implementations.
- Only spans recorded after this version is deployed are queryable via `listBranches`; historical traces remain accessible through the existing `listTraces` / `getTrace` APIs.
