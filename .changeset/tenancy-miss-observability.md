---
'@mastra/core': patch
'@mastra/server': patch
---

Add observability for scoped tenancy misses on datasets.

`DatasetsManager.delete` now returns `boolean` — `true` when a matching row was
deleted, `false` when nothing matched (either the id doesn't exist or the scope
didn't match). The two miss modes remain indistinguishable so cross-tenant
existence isn't leaked. `DatasetsManager` and the `Dataset` handle also emit a
`debug`-level log on scoped `get*`/`delete*` misses, carrying plain `op`, `id`,
`organizationId`, `projectId`.

`DELETE /datasets/:id` now returns `{ success: false }` on a scoped miss
(previously always `{ success: true }`). Unscoped missing-id still returns
`404`.

The abstract storage contract is unchanged — `deleteDataset`,
`deleteExperiment`, and `deleteExperimentResults` still return `Promise<void>`.
Third-party adapter implementations do not need updating.
