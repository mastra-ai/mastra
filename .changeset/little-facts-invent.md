---
'@mastra/react': minor
---

Added `useExperimentsItemUsage`, which returns the token usage and estimated cost of one or more experiments, keyed by experiment ID. Each experiment comes with its totals (`summary`) and the usage of every item, keyed by trace ID (`traces`). It sends one request per experiment, so it does not need the experiment results first, and keeps polling experiments that are still running.

```ts
const { data, isLoading } = useExperimentsItemUsage({
  experiments: [
    { id: 'exp-1', status: 'completed' },
    { id: 'exp-2', status: 'running' },
  ],
  supportsMetrics: true,
});

const total = data['exp-1']?.summary;
const item = data['exp-1']?.traces[result.traceId];
// both: { inputTokens, outputTokens, estimatedCost, costUnit }
```

`estimatedCost` and `costUnit` are `undefined` when no price is known or when cost units are mixed.
