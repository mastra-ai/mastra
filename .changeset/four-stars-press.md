---
'@mastra/react': minor
---

Added `useTraceAggregate`, a hook that runs `client.aggregateTraces()` and returns grouped trace counts, error rates, latency percentiles, tokens and cost. It only refetches when the request changes or you call `refetch()`.

```tsx
import { useTraceAggregate } from '@mastra/react/hooks/traces';

const { data } = useTraceAggregate({
  request: {
    timeRange: { from, to },
    groupBy: ['entityName'],
    measures: ['count', 'errorRate', 'cost.sum'],
  },
});
```
