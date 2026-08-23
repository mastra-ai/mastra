---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'@mastra/spanner': patch
---

Persist dynamic workflow bundles atomically through the workflow-definitions
storage domain. `Mastra.addDynamicWorkflows()` now commits every root and nested
definition together, or leaves both storage and the live registry unchanged.

Custom workflow-definition stores must implement `upsertMany()` with the same
all-or-nothing semantics. MongoDB deployments must use a replica set or sharded
cluster because standalone MongoDB cannot provide multi-document transactions.

```ts
await mastra.addDynamicWorkflows([helperDefinition, rootDefinition], {
  authorId: verifiedOwnerId,
});
```
