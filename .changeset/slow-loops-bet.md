---
'@mastra/playground-ui': patch
---

Added a `withQueryTrace` option for servers that do not support the trace query API. Set it to `false` to list traces through the older light trace list endpoint:

- `useTraceQuery` accepts `withQueryTrace` and `legacyFilters` (built with `buildTraceListFilters`).
- `createTraceFilterBarFields` only offers fields the light endpoint can filter on, with the `is` operator.
- `TraceColumnsMenu` hides the "Add metadata column" action.
