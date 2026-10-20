---
'@mastra/core': minor
---

Added thread rows with activity timestamps, trace counts, previews, root-agent model details, filtering and sorting.

**Breaking contract change:** Thread-row requests use `timeRange.traces` or `timeRange.threads` instead of `traces.timeRange`. Related-trace predicates are not supported in the new contract. Legacy identity requests remain supported for mixed package versions.

```ts
// Before
const before = { traces: { timeRange: { from, to } } };
// After
const after = { timeRange: { traces: { from, to } } };
```
