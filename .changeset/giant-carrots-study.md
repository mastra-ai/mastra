---
'@mastra/react': minor
---

`useCompareExperiments` now compares two to ten experiments at once. Pass `experimentIds` (and optionally `baselineId`) instead of `experimentIdA` and `experimentIdB`. The `options` parameter, which no longer had any fields, is removed.

```ts
// Before
useCompareExperiments({ datasetId, experimentIdA: 'exp-1', experimentIdB: 'exp-2' });

// After
useCompareExperiments({ datasetId, experimentIds: ['exp-1', 'exp-2', 'exp-3'], baselineId: 'exp-1' });
```

Added hooks that load several experiments in parallel: `useDatasetExperimentsQueries`, `useAllDatasetExperimentResultsQueries` (every page of results, not just the first) and `useScoresByExperimentIdsQueries`. Each returns its data keyed by experiment ID and keeps polling experiments that are still running.
