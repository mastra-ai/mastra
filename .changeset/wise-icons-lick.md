---
'@mastra/server': minor
---

Added advanced trace-query delta request validation and responses, including numbered-page polling cursors and cursor error handling.

```ts
// Start with a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
if (!page.deltaCursor) throw new Error('Delta polling is unavailable');
// Continue with delta polling.
const delta = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor });
```
