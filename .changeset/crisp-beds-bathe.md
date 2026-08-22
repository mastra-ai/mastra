---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/core': patch
'mastra': patch
---

Added storage for live-scoring sampling decision records (a new `mastra_scoring_decisions` table) so scoring coverage can be computed from sampled and declined decisions. The table is created automatically on `init()` for LibSQL and PG storage adapters. Decision rows are written through the scores storage domain:

```typescript
const scores = await storage.getStore('scores');
await scores.saveScoringDecision({
  scorerId: 'answer-relevancy',
  decision: 'declined',
  samplingType: 'ratio',
  samplingRate: 0.1,
  traceId,
  spanId,
});
```
