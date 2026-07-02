---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Return boolean from storage deletes so callers can distinguish hit from miss

Scoped storage deletes silently no-op on mismatch by design — a scoped delete
against a missing or mismatched row is indistinguishable from a legit 404 to
the caller, which is the correct security posture (throwing on mismatch would
leak existence via error timing or message). That left operators and callers
with no observability signal at all.

**Storage delete methods now return a boolean instead of `void`:**

- `deleteDataset` → `Promise<boolean>`
- `deleteExperiment` → `Promise<boolean>`
- `deleteExperimentResults` → `Promise<boolean>`

`true` means a matching row was found and deleted. `false` means nothing was
deleted — either the row does not exist or the scope filters did not match.
The two miss modes are deliberately indistinguishable so cross-tenant
existence is not leaked. Adapter authors implementing these abstract methods
will see a build error and can fix each site by returning the boolean derived
from their destructive result (rows affected, deleted count, or a
transactional gate check).

**Wire behavior change on `DELETE /datasets/:id`:**

The server handler now returns `{ success: boolean }` reflecting whether a row
was actually deleted:

- Scoped delete (with `organizationId` and/or `projectId` query params) that
  targets a missing id or a scope-mismatched row: `200 { success: false }`.
  Legit 404 and scope mismatch remain indistinguishable to preserve the
  no-leak contract.
- Unscoped delete that targets a missing id: `404` (unchanged from prior
  behavior — the handler throws `DATASET_NOT_FOUND` when nothing was
  deleted and no scope was supplied).

Callers who previously treated `success: true` as "the server processed the
request" and used that to fire a "Deleted" UI toast will now see the toast
only when a row was actually removed, which is usually the intended UX.

**Manager-layer debug logs:**

`DatasetsManager` and the `Dataset` handle emit a `debug`-level log when a
scoped `get*` returns null or a scoped delete/mutation targets a
missing/mismatched record. The log carries `op`, `id`, `organizationId`, and
`projectId` — the same identifiers that already appear in HTTP access logs
for scoped calls. Deployments that sanitize or redact HTTP access logs
should apply the same treatment to the debug channel if these identifiers
are considered sensitive in their environment.
