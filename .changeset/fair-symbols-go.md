---
'@mastra/server': patch
---

Added spanQueryParentEntityFields, spanQueryRootEntityFields and spanQueryExecutionSource capabilities so clients can hide unsupported span filters. For example, check capabilities.spanQueryExecutionSource before showing the execution source filter. Missing capabilities default to false.
