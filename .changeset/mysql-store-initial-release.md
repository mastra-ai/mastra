---
'@mastra/mysql': minor
---

Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more).

```ts
import { MySQLStore } from '@mastra/mysql';

const store = new MySQLStore({
  connectionString: 'mysql://user:password@localhost:3306/mastra',
});
```

This release also makes table and index setup reliable on a brand-new database:

- Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
- Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.
