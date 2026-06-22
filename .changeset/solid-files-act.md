---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Added optional `organizationId` and `projectId` fields to scores for multi-tenant isolation. Scores can now be saved with tenancy metadata and the `listScoresBy*` methods accept a `filters` option to scope results by organization and project.

```ts
await storage.saveScore({ ...score, organizationId: 'org-a', projectId: 'proj-1' });

const result = await storage.listScoresByScorerId({
  scorerId,
  filters: { organizationId: 'org-a', projectId: 'proj-1' },
});
```

`projectId` identifies the project scope, separate from `resourceId` which continues to mean the agent memory resource.
