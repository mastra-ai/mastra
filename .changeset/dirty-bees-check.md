---
'@mastra/core': minor
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Add multi-tenant filtering and candidate identity to datasets.

The datasets domain now supports the same per-row tenancy contract as the observability domain. Datasets and dataset items expose `organizationId` and `resourceId`; `listDatasets` and `listItems` accept matching filters. Dataset items inherit the tenancy of their parent dataset automatically — they cannot be set per-call.

Datasets also expose two new optional identity fields, `candidateKey` and `candidateId`, for use cases (such as auto-materialized candidate datasets) that need a stable per-incident identity at the dataset level.

The `DatasetItemSource['type']` union now includes `'candidate-screener'` so externally-materialized items can be distinguished from user-uploaded ones.

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
