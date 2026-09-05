---
'@mastra/pg': minor
---

Added read/write pool separation to `PostgresStore`. Pass `writePool` together with an optional `readPool` to route plain reads to a replica while writes, schema setup, transactions, locking reads, and every read-modify-write path stay on the primary. When `readPool` is omitted, reads fall back to the writer, and the existing single `pool` configuration keeps working unchanged. Closes #12035.

```ts
import { Pool } from 'pg';
import { PostgresStore } from '@mastra/pg';

const store = new PostgresStore({
  id: 'pg',
  writePool: new Pool({ connectionString: process.env.PG_PRIMARY_URL }),
  readPool: new Pool({ connectionString: process.env.PG_REPLICA_URL }),
});

store.pool; // writer
store.readPool; // reader (falls back to the writer when readPool is omitted)
```

Standalone reads such as `getThreadById`, `listThreads`, `agents.getById`, or `knowledge.search` hit `readPool`. Lookups that feed a mutation (for example the thread check inside `saveMessages`, the metadata merge in `updateThread`, or version resolution inside `skills.update`) always hit `writePool`, so a lagging replica cannot cause false "not found" errors or overwrite recent writes. Caller-provided pools are never closed by the store.
