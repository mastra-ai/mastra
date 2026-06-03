---
'@mastra/pg': patch
---

Added notification inbox storage support for Postgres stores.

```ts
import { PostgresStore } from '@mastra/pg';

const storage = new PostgresStore({ connectionString: process.env.POSTGRES_URL! });
```

Agents using this store can persist thread-scoped notification inbox records for notification signals.
