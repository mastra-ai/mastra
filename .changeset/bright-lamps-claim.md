---
'@mastra/pg': patch
---

Added PostgreSQL storage support for durable Harness sessions, attachments, channel delivery state, and scheduled wakeups.

```ts
import { Harness } from '@mastra/core/harness/v1';
import { PostgresStore } from '@mastra/pg';

const storage = new PostgresStore({
  id: 'app-storage',
  connectionString: process.env.DATABASE_URL!,
});
await storage.init();

const harness = new Harness({
  modes: [],
  storage,
});
```

Harness apps can now switch from in-memory session state to PostgreSQL-backed persistence with transactional storage guarantees.
