---
'@mastra/react': minor
---

Added `useTraceAggregate()` to fetch grouped trace totals with `client.aggregateTraces()`. Check `useTraceAggregateAvailable()` before enabling it. `useTraceMetadataFilterFields()` now also returns `aggregate`, the dimensions and measures the server can group by, when the server reports them.

```tsx
const { data } = useTraceAggregate({
  request: {
    timeRange: { from, to },
    groupBy: ['entityName'],
    measures: ['count', 'errorRate'],
    orderBy: { field: 'count', direction: 'desc' },
    limit: 50,
  },
  enabled: useTraceAggregateAvailable().enabled,
});
```
