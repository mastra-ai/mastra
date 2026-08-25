---
'@mastra/libsql': minor
---

Added a reusable SQLite client contract so storage adapters can use compatible SQLite drivers.

```typescript
import type { SqliteClient } from '@mastra/libsql';

const client: SqliteClient = createCompatibleSqliteClient();
```
