---
'@mastra/pg': minor
---

Added PostgreSQL support for handing numbered trace-query pages to delta polling. Polls use a safe transaction watermark and detect completed root writes.

```ts
// Start with a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
// Continue with delta polling.
const delta = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor });
```
