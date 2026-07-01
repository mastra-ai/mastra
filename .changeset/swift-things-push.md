---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`.

The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

Related: [MASTRA-4438](https://linear.app/kepler-crm/issue/MASTRA-4438)
