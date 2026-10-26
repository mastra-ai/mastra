---
'@mastra/client-js': minor
---

Added `aggregateSpans()` for grouped span measures, such as agent-run counts by status per day, including nested agent runs.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
if (capabilities.spanAggregate) {
  const { rows } = await client.aggregateSpans({
    timeRange: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' },
    where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
    groupBy: ['status'],
    interval: '1d',
    measures: ['count'],
  });
}
```
