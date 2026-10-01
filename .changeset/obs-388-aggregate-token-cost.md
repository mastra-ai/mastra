---
'@mastra/core': minor
---

Added token and cost measures to `aggregateTraces()`. Requests can now ask for `tokens.input`, `tokens.output`, `tokens.total`, `tokens.reasoning`, and `tokens.cached` (each as `.sum` or `.avg`), plus `cost.sum` and `cost.avg`, and use them in `having` and `orderBy`.

Usage is summed per trace first, then per group, so averages are per trace. Any request for a `cost.*` measure also returns `cost.coverage` (the share of traces with token usage that have a priced cost) and `costUnit`. When a group mixes currencies, `cost.sum` and `cost.avg` are `null` and `costUnit` is `"mixed"`. Groups whose measure is `null` sort last and never satisfy a `having` condition.

```ts
import { parseTraceAggregateRequest, planTraceAggregate } from '@mastra/core/storage';

const plan = planTraceAggregate(
  parseTraceAggregateRequest({
    timeRange: { from: '2026-06-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
    orderBy: { field: 'cost.sum', direction: 'desc' },
    limit: 20,
  }),
);

const { rows } = await storage.aggregateTraces(plan);
// rows[0].measures → { count, 'tokens.input.sum', 'tokens.output.sum', 'cost.sum', 'cost.coverage', costUnit }
```

`TokenMetrics`, the names of the token usage metrics, is now exported from `@mastra/core/observability`.
