---
'@mastra/core': minor
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/cloudflare-d1': patch
'@mastra/dsql': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/clickhouse': patch
'@mastra/spanner': patch
'@mastra/mongodb': patch
'@mastra/redis': patch
'@mastra/upstash': patch
'@mastra/dynamodb': patch
'@mastra/convex': patch
'@mastra/lance': patch
'@mastra/cloudflare': patch
---

Add a `batchId` handle to scores so all per-trace scores produced by one batch
scoring call can be grouped and read back together. Each score keeps its own
per-execution `runId`; `batchId` is the shared batch key.

- New nullable `batchId` column on the scores table and `batchId` field on
  `ScoreRowData` / save payloads.
- New `listScoresByBatchId({ batchId, pagination, filters })` read method on the
  scores storage domain, tenant-scoped via `organizationId` / `projectId`
  filters like the other list methods. Implemented across all built-in storage
  adapters (in-memory plus every `@mastra/*` store).
- `runScorerOnTarget` accepts an optional `batchId` that is stamped on the
  persisted score.

```ts
const batchId = crypto.randomUUID();

for (const target of targets) {
  await runScorerOnTarget({ storage, scorer, target, batchId });
}

// Read every score from that batch, scoped to a tenant.
const { scores } = await storage
  .getStore('scores')
  .then(s => s!.listScoresByBatchId({
    batchId,
    pagination: { page: 0, perPage: 100 },
    filters: { organizationId, projectId },
  }));
```
