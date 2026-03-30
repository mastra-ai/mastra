---
'@mastra/core': minor
---

Added support for attaching scorers to datasets. Scorers attached to a dataset automatically run when an experiment is triggered, alongside any scorers specified at trigger time. New `scorerIds` field on `DatasetRecord`, `CreateDatasetInput`, and `UpdateDatasetInput` types.
