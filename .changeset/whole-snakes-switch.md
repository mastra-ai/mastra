---
'@mastra/client-js': minor
---

`client.compareExperiments()` now compares two to ten experiments at once against a baseline. Pass `experimentIds` and optionally `baselineId`:

```ts
await client.compareExperiments({ datasetId, experimentIds: ['exp-1', 'exp-2', 'exp-3'], baselineId: 'exp-1' });
```

`experimentIdA` / `experimentIdB` still work for comparing two experiments, but are deprecated in favor of `experimentIds`.
