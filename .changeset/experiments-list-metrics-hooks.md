---
'@mastra/react': minor
---

Added two hooks for listing many experiments without one request per row:

- `useExperimentsListMetrics` returns token usage, estimated cost and average agent duration for a list of experiments, keyed by experiment id.
- `useDatasetsByIds` loads only the datasets you need by id, for example to show the dataset names of listed experiments.

```tsx
const { data: metrics } = useExperimentsListMetrics({ experiments, supportsMetrics: true });
const { data: datasets } = useDatasetsByIds({ datasetIds: experiments.map(e => e.datasetId) });
```
