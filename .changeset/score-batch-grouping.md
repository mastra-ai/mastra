---
'@mastra/core': minor
'@mastra/pg': patch
---

Add a `batchId` handle to scores so all per-trace scores produced by one batch
scoring call can be grouped and read back together. Each score keeps its own
per-execution `runId`; `batchId` is the shared batch key.

- New nullable `batchId` column on the scores table and `batchId` field on
  `ScoreRowData` / save payloads.
- New `listScoresByBatchId({ batchId, pagination, filters })` read method on the
  scores storage domain, tenant-scoped via `organizationId` / `projectId`
  filters like the other list methods. Implemented for in-memory and Postgres;
  other adapters throw a not-implemented error until ported.
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
