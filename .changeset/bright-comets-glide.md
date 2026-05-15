---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
---

Added favorites support to storage adapters so callers can favorite/unfavorite stored agents and skills, query favorite state alongside list results, and filter listings by visibility.

**Example**

```ts
const storage = new LibSQLStore({ /* config */ });
const favorites = await storage.getStore('favorites');

await favorites?.favorite({
  userId: 'user-1',
  entityType: 'agent',
  entityId: 'agent-42',
});
```
