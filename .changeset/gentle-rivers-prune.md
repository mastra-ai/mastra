---
'@mastra/dsql': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
---

Added configurable age-based pruning for observability spans.

```typescript
const retention = {
  observability: { spans: { maxAge: '30d' } },
} as const;

const stores = [
  new MySQLStore({ ...mysqlConnection, retention }),
  new MSSQLStore({ ...mssqlConnection, retention }),
  new DSQLStore({ ...dsqlConnection, retention }),
];

await Promise.all(stores.map(storage => storage.prune()));
```
