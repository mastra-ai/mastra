---
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/spanner': patch
---

Persist and filter dataset tenancy + candidate identity in storage adapters.

`createDataset` now persists `organizationId`, `projectId`, `candidateKey`, and `candidateId`. `listDatasets` and `listItems` accept matching tenancy filters. Dataset items inherit `organizationId` / `projectId` from their parent dataset on insert, update, delete, and batch insert/delete — items are never settable per call (item tenancy follows dataset tenancy).

All new columns are nullable and added retroactively via each adapter's existing column-migration path; no breaking DDL. Existing rows continue to read and write fine; new writes can choose to stamp tenancy.

```ts
await storage.createDataset({
  name: 'candidates/missing-tool-call/incident-123',
  organizationId: 'org_abc',
  projectId: 'project_xyz',
  candidateKey: 'missing-tool-call',
  candidateId: 'incident-123',
});

await storage.listDatasets({
  pagination: { page: 0, perPage: 20 },
  filters: { organizationId: 'org_abc', projectId: 'project_xyz' },
});
```
