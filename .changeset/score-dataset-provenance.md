---
'@mastra/core': minor
'@mastra/pg': patch
---

Add `datasetId` / `datasetItemId` provenance handles to scores so baseline scores
produced against a curated dataset can be joined back to the dataset item (ground
truth) they scored — without re-running the agent.

- New nullable `datasetId` / `datasetItemId` columns on the scores table and
  fields on `ScoreRowData` / save payloads.
- New `listScoresByDatasetId({ datasetId, pagination, filters })` read method on
  the scores storage domain, tenant-scoped via `organizationId` / `projectId`
  filters like the other list methods. Implemented for in-memory and `@mastra/pg`;
  other adapters fall back to a default-throw and will be filled in as a follow-up.
- `runScorerOnTarget` accepts optional top-level `datasetId` / `datasetItemId`
  (independent of how the trace is resolved) that are stamped on the persisted
  score alongside `batchId`.

```ts
for (const item of datasetItems) {
  await runScorerOnTarget({
    storage,
    scorer,
    target: { traceId: item.source.referenceId },
    datasetId,
    datasetItemId: item.id,
  });
}

// Read every baseline score for a dataset, scoped to a tenant.
const { scores } = await storage
  .getStore('scores')
  .then(s => s!.listScoresByDatasetId({
    datasetId,
    pagination: { page: 0, perPage: 100 },
    filters: { organizationId, projectId },
  }));
```
