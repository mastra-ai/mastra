---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added optional `organizationId` and `projectId` query parameters to the dataset routes.

`GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

**Example**

```
GET /datasets/abc123?organizationId=org_a&projectId=proj_1
DELETE /datasets/abc123?organizationId=org_a
```

Related: [MASTRA-4438](https://linear.app/kepler-crm/issue/MASTRA-4438)
