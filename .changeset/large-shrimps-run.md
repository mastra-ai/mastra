---
'@mastra/libsql': minor
---

Added configurable local journal modes while preserving WAL as the default.

```ts
const storage = new LibSQLStore({
  id: 'local-storage',
  url: 'file:./mastra.db',
  journalMode: 'delete',
});
```
