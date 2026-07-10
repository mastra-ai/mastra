---
'@mastra/client-js': patch
---

Added the `name` and `description` fields to the `DatasetExperiment` type. The server already returned these values, so you can now read an experiment's name and description from `listDatasetExperiments`, `listExperiments`, and `getDatasetExperiment` without a cast.
