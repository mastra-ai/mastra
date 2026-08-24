---
'@mastra/pg': patch
---

Fixed `PgVector` scanning every vector table on startup. Constructing a `PgVector` warms an index cache in the background, and that warmup asked for full index statistics, which include `SELECT COUNT(*)` per table. On a large index that is a full table scan per index, per process start, and the warmup never used the count it paid for. `query()`, `upsert()`, `updateVector()` and the "has this index changed?" check in `createIndex()` paid for the same count.

These paths now read only the index metadata they use (dimension, metric, index type, vector type, index configuration), all of which comes from the Postgres catalog at a cost that does not grow with the size of the table.

`describeIndex()` is unchanged and still returns an exact `count`:

```ts
const stats = await pgVector.describeIndex({ indexName: 'embeddings' });
console.log(stats.count); // exact row count, as before
```

Concurrent callers on a cold cache also no longer duplicate the lookup: the first call is shared with everyone waiting on it, and a failed lookup is not cached.

Fixes [#21952](https://github.com/mastra-ai/mastra/issues/21952).
