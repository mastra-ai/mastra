---
'@mastra/core': minor
---

Added an optional `include: { tableSummary: true }` projection to advanced trace queries. Each trace row then carries a bounded `tableSummary` with the output preview, tags, model, time to first token, error counts, prompt-cache token totals, and the newest feedback and score records with truncation flags, so a Traces table renders from one request.

```typescript
// request
{ timeRange, include: { tableSummary: true }, page: { limit: 25 } }

// each trace row
{
  traceId: 'trace-123',
  tableSummary: {
    outputPreview: 'The known interaction is…',
    tags: ['production'],
    model: 'gpt-5',
    timeToFirstTokenMs: 420,
    errorCounts: { total: 2, llm: 1, tool: 1 },
    promptCacheReadTokens: 1200,
    promptCacheCreationTokens: 300,
    feedback: [/* newest 10 */], feedbackTruncated: false,
    scores: [/* newest 10 */], scoresTruncated: true,
  },
}
```
