---
'@mastra/core': minor
---

Added optional textSearch contracts for querySpans() and queryTraces(), with normalized literal substring input and search-bound cursors. For stores advertising search support, pass textSearch: "connection timeout" alongside timeRange; omit textSearch for existing queries. Database search implementations are provided separately.

```typescript
// Existing requests remain unchanged.
await client.queryTraces({ timeRange });

// Requires the traceQueryTextSearch capability.
await client.queryTraces({ timeRange, textSearch: 'connection timeout' });
```
