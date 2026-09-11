---
'@mastra/server': minor
---

Removed thread grouping from the advanced trace-query endpoint. Requests containing `group` are now rejected, and successful responses always contain trace records.

**Before**

```ts
await fetch('/api/observability/traces/query', {
  method: 'POST',
  body: JSON.stringify({ timeRange, group: { by: ['threadId'] } }),
});
```

**After**

```ts
await fetch('/api/observability/traces/query', { method: 'POST', body: JSON.stringify({ timeRange }) });
```
