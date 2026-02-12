---
'@mastra/client-js': minor
---

Added client methods for the Datasets and Experiments API. New methods on `MastraClient`:

- `listDatasets`, `getDataset`, `createDataset`, `updateDataset`, `deleteDataset`
- `listDatasetItems`, `getDatasetItem`, `addDatasetItem`, `updateDatasetItem`, `deleteDatasetItem`
- `bulkAddDatasetItems`, `bulkDeleteDatasetItems`
- `listDatasetVersions`, `getItemHistory`, `getDatasetItemVersion`
- `listDatasetExperiments`, `getDatasetExperiment`, `listDatasetExperimentResults`
- `triggerDatasetExperiment`, `compareExperiments`
