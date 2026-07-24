---
'@mastra/hana': minor
---

Added SAP HANA storage adapter (`@mastra/hana`) for HANA Cloud and S/4HANA DB.

Uses the `@sap/hana-client` native driver with a built-in connection pool. Supports all six Mastra storage domains: memory (threads, messages, resources), workflows, observability (spans/traces), scores, agents, and background tasks.

**Usage:**

```typescript
import { Mastra } from '@mastra/core';
import { HANAStore } from '@mastra/hana';

const store = new HANAStore({
  id: 'hana-storage',
  host: process.env.HANA_HOST,
  port: 443,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
});

const mastra = new Mastra({ storage: store });
await mastra.getStorage()?.init();
```

- Supports host/port credentials and bring-your-own-pool
- Built-in `HANAPool` manages min/max connections with a queue for backpressure
- Schema isolation via `schemaName` option (recommended for multi-tenant BTP deployments)
- HANA SQL dialect: `UPSERT ... WITH PRIMARY KEY`, `LIMIT/OFFSET` pagination, `NCLOB` for JSON, double-quoted identifiers
