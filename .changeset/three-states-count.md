---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Added support for filtering experiment results by tags in `listExperimentResults`. All requested tags must be present on a result for it to match.

```ts
const { results, pagination } = await storage.listExperimentResults({
  experimentId: 'exp-id',
  pagination: { page: 0, perPage: 50 },
  tags: ['regression', 'p0'],
});
```

`@mastra/libsql` also fixes `addExperimentResult` double-encoding `tags` on insert, and backfills previously affected rows on `init()` so they match the new filter.
