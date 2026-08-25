---
'@mastra/libsql': minor
---

Added embedded-replica sync support to LibSQLStore. You can now pass `syncUrl` and `syncInterval` to keep a local database file synced with a remote libSQL primary (for example Turso), matching the options LibSQLVector already supports.

```typescript
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({
  id: 'libsql-storage',
  url: 'file:./replica.db',
  syncUrl: 'libsql://your-db-name.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 60,
});
```

See https://github.com/mastra-ai/mastra/issues/21994
