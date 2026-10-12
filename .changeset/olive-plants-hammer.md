---
'@mastra/server': minor
---

The compare experiments route (`POST /api/datasets/:datasetId/compare`) now compares two to ten experiments at once. Send `experimentIds` and an optional `baselineId`:

```json
{ "experimentIds": ["exp-1", "exp-2", "exp-3"], "baselineId": "exp-1" }
```

The previous `{ "experimentIdA", "experimentIdB" }` body is still accepted and compares those two experiments with `experimentIdA` as the baseline. It is deprecated in favor of `experimentIds`.
