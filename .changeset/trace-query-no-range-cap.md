---
'@mastra/core': minor
---

Removed the 31-day limit on trace search time ranges. You can now search all of your retained trace data, as long as the range starts before it ends.

```ts
// Before: rejected because the range is longer than 31 days
// After: returns traces from the whole six-month range
await mastraClient.queryTraces({
  timeRange: { from: '2026-04-01T00:00:00Z', to: '2026-10-01T00:00:00Z' },
});
```
