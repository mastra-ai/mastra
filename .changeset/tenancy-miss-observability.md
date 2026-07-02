---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Observability for silent tenancy-mismatch no-ops in storage

Tenancy-scoped storage deletes silently no-op on mismatch by design — a scoped
delete and a legit 404 are indistinguishable to the caller, which is the correct
security posture (throwing on mismatch would leak existence via error timing or
message). That left operators and callers with no way to tell whether a scoped
delete actually removed anything.

Storage delete methods now return a boolean instead of `void`:

- `deleteDataset` → `Promise<boolean>`
- `deleteExperiment` → `Promise<boolean>`
- `deleteExperimentResults` → `Promise<boolean>`

`true` means a matching row was found and deleted. `false` means nothing was
deleted — either the row does not exist or the tenancy filters did not match.
The two miss modes are deliberately indistinguishable so cross-tenant existence
is not leaked.

`DatasetsManager.delete` propagates the boolean through to callers. The server
`DELETE /datasets/:id` handler now returns `{ success: boolean }` reflecting
whether anything was deleted; identical response shape for legit 404 and
tenancy mismatch preserves the no-leak contract.

For operator visibility, `DatasetsManager` and the `Dataset` handle emit a
`debug`-level log when a scoped `get*` returns null or a scoped mutation
targets a missing/mismatched record. The log carries `op`, `id`,
`organizationId`, and `projectId` — the same identifiers that already appear
in HTTP access logs for scoped calls.
