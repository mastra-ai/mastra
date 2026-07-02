---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`.

You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

**Example**

```ts
// Before
await client.getDataset('abc123');
await client.deleteDataset('abc123');
await client.updateDataset({ id: 'abc123', name: 'renamed' });

// After — scope to a tenant
await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
await client.deleteDataset('abc123', { organizationId: 'org_a' });
await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
```

Related: [MASTRA-4438](https://linear.app/kepler-crm/issue/MASTRA-4438)
