---
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Tenancy-scope experiments `getById` and `delete*` on `ExperimentsStorage`.

`ExperimentsStorage.getExperimentById`, `getExperimentResultById`, `deleteExperiment`, and `deleteExperimentResults` used to key on the primary id alone, so any caller who knew the id could read or delete the row regardless of tenant. All four now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner):

- On tenancy mismatch, `get*` returns `null` at the storage layer.
- On tenancy mismatch, `delete*` is a silent no-op.
- The tenancy predicate is folded into the destructive DML itself (scoped `WHERE` on the DELETE, an atomic gate + delete inside a transaction, or a scoped subquery for the results cascade). A concurrent tenant swap of the same id between a pre-check and the DELETE cannot let a scoped delete hit another tenant's row.

Both behaviors match how a missing id already responds, so existence does not leak through error timing or messages.

`Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

```ts
// Before: any caller who knew the id could read/delete across tenants.
await store.experiments.getExperimentById({ id: experimentId });
await store.experiments.deleteExperiment({ id: experimentId });

// After: pass the caller's scope; wrong tenant gets null / silent no-op.
await store.experiments.getExperimentById({
  id: experimentId,
  filters: { organizationId, projectId },
});
await store.experiments.deleteExperiment({
  id: experimentId,
  filters: { organizationId, projectId },
});
```

Related: [MASTRA-4445](https://linear.app/kepler-crm/issue/MASTRA-4445)
</content>
</invoke>