---
'@mastra/core': minor
---

Add multi-tenant filtering and candidate identity to the datasets domain.

`DatasetRecord`, `DatasetItem`, `DatasetItemRow`, `CreateDatasetInput`, and the `filters` on `ListDatasetsInput` / `ListDatasetItemsInput` now expose optional `organizationId` and `resourceId`, matching the per-row tenancy contract already used by the observability domain. Dataset items inherit tenancy from their parent dataset automatically — they cannot be set per-call.

`DatasetRecord` and `CreateDatasetInput` also gain two new optional identity fields, `candidateKey` and `candidateId`, for use cases that need a stable per-incident identity at the dataset level (such as auto-materialized candidate datasets).

The `DatasetItemSource['type']` union now includes `'candidate-screener'` so externally-materialized items can be distinguished from user-uploaded ones.

`DATASETS_SCHEMA` and `DATASET_ITEMS_SCHEMA` gain matching nullable columns, and `DatasetsInMemory` persists and filters on them.

**Before**

```ts
const dataset = await storage.createDataset({ name: 'goldens/checkout' });
const items = await storage.listDatasets({ pagination: { page: 0, perPage: 20 } });
```

**After**

```ts
const dataset = await storage.createDataset({
  name: 'candidates/missing-tool-call/incident-123',
  organizationId: 'org_abc',
  resourceId: 'project_xyz',
  candidateKey: 'missing-tool-call',
  candidateId: 'incident-123',
});

const items = await storage.listDatasets({
  pagination: { page: 0, perPage: 20 },
  filters: { organizationId: 'org_abc', resourceId: 'project_xyz' },
});
```
