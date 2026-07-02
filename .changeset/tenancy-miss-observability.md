---
'@mastra/core': patch
'@mastra/server': patch
---

Add observability signal for scoped tenancy misses on datasets and experiments

Scoped storage `get*ById` calls return `null` and scoped `delete*` calls silently
no-op when tenancy filters don't match — by design, so cross-tenant existence
isn't leaked through error timing or text. That left operators with no signal
at all when scoped ops missed.

**`DatasetsManager.delete` now returns `boolean`.**

`DatasetsManager.delete(...)` used to return `void`. It now returns `boolean`:
`true` when a matching row was deleted, `false` when nothing matched (either
the id doesn't exist or the scope filters didn't match). The two miss modes
remain indistinguishable so cross-tenant existence isn't leaked.

The abstract storage contract (`DatasetsStorage.deleteDataset`,
`ExperimentsStorage.deleteExperiment`, `ExperimentsStorage.deleteExperimentResults`)
is unchanged — those still return `Promise<void>`, matching every other delete
in the storage domain. The boolean signal is derived inside `DatasetsManager`
via a pre-delete scoped `getDatasetById` probe.

**Wire behavior change on `DELETE /datasets/:id`.**

The server handler now returns `{ success: boolean }` reflecting whether a row
was actually deleted:

- Scoped delete (with `organizationId` and/or `projectId` query params) that
  targets a missing id or a scope-mismatched row: `200 { success: false }`.
  Legit 404 and scope mismatch remain indistinguishable to preserve the
  no-leak contract.
- Unscoped delete that targets a missing id: `404` (unchanged — the handler
  throws `DATASET_NOT_FOUND` when nothing was deleted and no scope was
  supplied).

Callers who previously treated `success: true` as "the server processed the
request" and used that to fire a "Deleted" UI toast will now see the toast
only when a row was actually removed, which is usually the intended UX.

**Manager-layer debug logs.**

`DatasetsManager` and the `Dataset` handle emit a `debug`-level log when a
scoped `get*` returns null or a scoped delete/mutation targets a
missing/mismatched record. The log carries `op`, `id`, `organizationId`, and
`projectId` — the same identifiers that already appear in HTTP access logs
for scoped calls. Deployments that sanitize or redact HTTP access logs
should apply the same treatment to the debug channel if these identifiers
are considered sensitive in their environment.
