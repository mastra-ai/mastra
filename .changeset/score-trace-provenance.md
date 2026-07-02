---
'@mastra/core': minor
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/cloudflare-d1': patch
'@mastra/dsql': patch
'@mastra/mssql': patch
'@mastra/upstash': patch
---

Add optional `batchId`, `datasetId`, and `datasetItemId` fields to persisted scores so saved baseline scores can be grouped as one scoring pass and joined back to the dataset items they came from.

- `scoreTrace()` accepts top-level `batchId`, `datasetId`, and `datasetItemId` when persisting a score for a stored trace.
- `ScoreRowData` and score save payloads now include nullable `batchId`, `datasetId`, and `datasetItemId`.
- Built-in stores with explicit score schema or attribute mappings now persist these provenance fields on saved scores.
- D1, DSQL, MSSQL, and Upstash score stores now apply additive provenance migrations or deterministic score ordering for persisted score reads.

```ts
await scoreTrace({
  storage,
  scorer,
  target: { traceId },
  batchId: 'baseline-batch-1',
  datasetId,
  datasetItemId,
});
```
