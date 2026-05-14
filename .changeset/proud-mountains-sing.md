---
'@mastra/pg': minor
---

Added favorites support to the Postgres adapter so callers can favorite/unfavorite stored agents and skills, query favorite state alongside list results, and filter listings by visibility.

**Example**

```ts
const storage = new PgStore({ /* config */ });
const favorites = await storage.getStore('favorites');

await favorites?.favorite({
  userId: 'user-1',
  entityType: 'skill',
  entityId: 'skill-42',
});
```
