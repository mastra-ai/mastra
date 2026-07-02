---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Observability for silent tenancy-mismatch no-ops in storage

Tenancy-scoped storage operations silently no-op on mismatch by design — getters
return `null`, deletes affect zero rows — so a scoped miss and a legit 404 are
indistinguishable from the caller's perspective. That's the correct security
posture (a thrown error would leak existence via timing/text), but it leaves
operators without a signal when a scoped call is behaving unexpectedly.

Adds a debug-level log at the storage layer for silent tenancy misses on:

- `getDatasetById`, `deleteDataset`
- `getExperimentById`, `deleteExperiment`
- `getExperimentResultById`, `deleteExperimentResults`

The log carries `op`, `table`, and an opaque 8-char correlation token derived
from `sha256(id + ':' + organizationId + ':' + projectId)`. The raw id and
tenancy are never logged. Debug level only, no rate-limiting, no metrics; grep
for `tenancy: scoped read miss` / `tenancy: scoped delete no-op` when
investigating.

```text
DEBUG  tenancy: scoped read miss   { op: 'getExperimentById', table: 'mastra_experiments', token: '3a1f9b21' }
DEBUG  tenancy: scoped delete no-op { op: 'deleteDataset',     table: 'mastra_datasets',    token: '3a1f9b21' }
```

Emission is gated on `filters` being tenancy-scoped, so unscoped calls that
return null on a legit 404 don't emit noise.

No behavior change to any storage contract, no return-shape change, no new
public API surface beyond three internal helpers on the storage domain.
