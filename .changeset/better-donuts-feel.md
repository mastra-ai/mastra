---
'@mastra/pg': minor
---

Added experiment provenance and grouping support to `@mastra/pg`. When PostgreSQL is configured as Mastra storage, these fields remain available for later grouping and filtering.

```ts
import { PostgresStore } from '@mastra/pg';

const storage = new PostgresStore({
  id: 'postgres-storage',
  connectionString: process.env.DATABASE_URL!,
});

await dataset.startExperiment({
  task,
  scorers,
  provenance: { source: 'github', sourceVersion: 'abc123' },
  grouping: { experimentSetId: 'benchmark-1', variantId: 'candidate', trialIndex: 0 },
});
```
