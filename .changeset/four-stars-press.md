---
'@mastra/react': minor
---

Added `useTraceAggregate` and `useSpanAggregate`, hooks that run `client.aggregateTraces()` and `client.aggregateSpans()` and return grouped counts, error rates, latency percentiles, tokens and cost. They only refetch when the request changes or you call `refetch()`. Check `useTraceAggregateAvailable()` or `useSpanAggregateAvailable()` before enabling them.

```tsx
import { useSpanAggregate } from '@mastra/react/hooks/traces';

const { data } = useSpanAggregate({
  request: {
    timeRange: { from, to },
    where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
    groupBy: ['entityName'],
    measures: ['count', 'errorRate', 'duration.p95'],
  },
});
```
