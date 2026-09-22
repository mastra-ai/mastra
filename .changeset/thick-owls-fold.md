---
'@mastra/clickhouse': minor
---

Added ClickHouse support for handing numbered trace-query pages to delta polling, with stable cursor tie-breaking and the existing two-day retention window.

Numbered pages remain available without a polling cursor when the installed core version lacks trace-query delta support.

```ts
// Start with a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
// Continue with delta polling.
const delta = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor });
```
