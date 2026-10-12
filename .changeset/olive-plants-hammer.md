---
'@mastra/server': minor
---

The compare experiments route (`POST /api/datasets/:datasetId/compare`) now compares two to ten experiments at once. Its body takes `experimentIds` and an optional `baselineId` instead of `experimentIdA` and `experimentIdB`.

**Upgrading**

```diff
- { "experimentIdA": "exp-1", "experimentIdB": "exp-2" }
+ { "experimentIds": ["exp-1", "exp-2"], "baselineId": "exp-1" }
```
