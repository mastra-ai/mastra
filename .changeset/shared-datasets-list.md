---
'@mastra/playground-ui': minor
---

Exported the datasets list building blocks from `@mastra/playground-ui/domains/datasets` (`DatasetsList`, `DatasetsToolbar`, `DatasetsFilterBar`, `CreateDatasetDialog`, `NoDatasetsInfo`, `DatasetsListSkeleton`, target filter helpers) and `ComputedTag` from `@mastra/playground-ui/domains/observability`, so apps other than Studio can render the datasets list. `CreateDatasetDialog` now opens the new dataset through the app's `paths.datasetLink`.
