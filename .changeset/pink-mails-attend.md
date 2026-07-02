---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters.

Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

**What changed**

- `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
- The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
- The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
- Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

**Behavior**

- Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
- On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

**Example**

```ts
// Before
const ds = await mastra.datasets.get({ id });
await mastra.datasets.delete({ id });

// After — scope to a tenant
const ds = await mastra.datasets.get({ id, organizationId, projectId });
await mastra.datasets.delete({ id, organizationId, projectId });
```

Related: [MASTRA-4438](https://linear.app/kepler-crm/issue/MASTRA-4438)
