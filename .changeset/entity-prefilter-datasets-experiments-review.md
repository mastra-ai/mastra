---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground': patch
---

Scope dataset and experiment listings to a target entity server-side.

- `@mastra/server`: `GET /datasets` accepts `targetType` and `targetIds` query params; `GET /experiments` and `GET /datasets/:datasetId/experiments` accept `targetType` and `targetId`. The filters are forwarded to storage, which already supported them.
- `@mastra/client-js`: `listDatasets()`, `listExperiments()` and `listDatasetExperiments()` accept the same target filters.
- `@mastra/playground`: the Datasets, Experiments and Review queue pages read `?targetType=` / `?targetId=` from the URL and expose a Target filter in their toolbars, so the global pages can show the same scoped view as an agent's Evaluate / Review tabs.
