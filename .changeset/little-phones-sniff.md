---
'@mastra/core': minor
---

Added delta polling to advanced trace queries, including a cursor on numbered pages for the initial-load-to-poll handoff. Delta cursors bind the predicate and time range; keyset pagination remains unchanged.

```ts
// Before: load a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
// After: continue polling from that page without rescanning it.
const updates = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor, limit: 100 });
```

Polling returns newly completed roots and root completions. It does not provide deletion notifications or guarantee re-emission after related-record changes.
