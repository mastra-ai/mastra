---
'@mastra/core': minor
---

Added an optional `include: { tableSummary: true }` projection to advanced trace queries. Each trace row then carries a bounded `tableSummary` with the output preview, tags, model, time to first token, error counts, prompt-cache token totals, and the newest feedback and score records with truncation flags, so a Traces table renders from one request.

```typescript
const result = await mastraClient.queryTraces({
  timeRange,
  include: { tableSummary: true },
  page: { limit: 25 },
})
result.traces[0].tableSummary?.model // 'gpt-5'
```
