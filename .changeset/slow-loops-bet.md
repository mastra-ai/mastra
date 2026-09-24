---
'@mastra/playground-ui': patch
---

Added a `withQueryTrace` option to `useTraceQuery`. Set it to `false` and pass `legacyFilters` to list traces through the older light trace list endpoint, for servers that do not support the trace query API.
