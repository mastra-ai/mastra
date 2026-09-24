---
'@mastra/client-js': minor
---

Added `include: { tableSummary: true }` to `queryTraces()`. Each returned trace row then carries a typed `tableSummary` with the output preview, tags, model, time to first token, error counts, prompt-cache token totals, and the newest feedback and score records with truncation flags.

```typescript
const result = await mastraClient.queryTraces({
  timeRange,
  include: { tableSummary: true },
  page: { limit: 25 },
})
result.traces[0].tableSummary?.model // 'gpt-5'
```
