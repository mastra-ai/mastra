---
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Tenancy-scope `getExperimentById` and `getExperimentResultById`.

`ExperimentsStorage.getExperimentById` and `ExperimentsStorage.getExperimentResultById` used to look up an experiment (or experiment result) by its primary key alone, so any caller who knew the id could read it regardless of tenant. Both getters now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced in the SQL/collection predicate on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner). On tenancy mismatch the storage layer returns `null` — matching how a missing id already behaves, so existence does not leak through error timing or messages.

`Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

Related: [MASTRA-4445](https://linear.app/kepler-crm/issue/MASTRA-4445)
