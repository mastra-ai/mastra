---
'@mastra/client-js': minor
---

Added client methods for the Datasets and Experiments API. New methods on `MastraClient`:

- `listDatasets`, `getDataset`, `createDataset`, `updateDataset`, `deleteDataset`
- `listDatasetItems`, `getDatasetItem`, `addDatasetItem`, `updateDatasetItem`, `deleteDatasetItem`
- `batchInsertDatasetItems`, `batchDeleteDatasetItems`
- `listDatasetVersions`, `getItemHistory`, `getDatasetItemVersion`
- `listDatasetExperiments`, `getDatasetExperiment`, `listDatasetExperimentResults`
- `triggerDatasetExperiment`, `compareExperiments`
