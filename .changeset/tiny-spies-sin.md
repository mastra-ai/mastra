---
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mysql': minor
'@mastra/mssql': minor
'@mastra/spanner': minor
---

Added saved views storage, so Studio can save trace views (filters, time range, sort and columns) to your database. The `mastra_saved_views` table is created on init, like the other tables, with an index on `(page, createdAt)`. Requires `@mastra/core` ≥ 1.80.0.

```ts
const storage = new PostgresStore({ id: 'storage', connectionString: process.env.DATABASE_URL });
const savedViews = await storage.getStore('savedViews');
const { views } = await savedViews!.list({ page: 'traces' });
```
