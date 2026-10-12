---
'@mastra/client-js': minor
---

`client.compareExperiments()` now compares two to ten experiments at once against a baseline. Pass `experimentIds` (and optionally `baselineId`) instead of `experimentIdA` and `experimentIdB`.

**Upgrading**

```ts
// Before
await client.compareExperiments({ datasetId, experimentIdA: 'exp-1', experimentIdB: 'exp-2' });

// After
await client.compareExperiments({ datasetId, experimentIds: ['exp-1', 'exp-2', 'exp-3'], baselineId: 'exp-1' });
```
