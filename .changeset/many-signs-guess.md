---
'@mastra/pg': minor
---

Added PgFactoryStorage for persisting Mastra agent state and lifecycle-managed application domains through one PostgreSQL pool.

```ts
import { PgFactoryStorage } from '@mastra/pg';

const storage = new PgFactoryStorage({ connectionString: process.env.DATABASE_URL! });
await storage.init();
```
