---
'@mastra/react': patch
---

Added `traceAggregateQueryKey` and `traceQueryLegacyKey`, the cache keys of `useTraceAggregate` and of the legacy list in `useTraceQuery`, so apps can read those queries from the cache as they already can with `traceQueryKey`.
