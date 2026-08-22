---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/core': patch
'mastra': patch
---

Added storage for live-scoring sampling decision records (a new `mastra_scoring_decisions` table) so scoring coverage can be computed from sampled and declined decisions. The table is created automatically on `init()` for LibSQL and PG storage adapters, and decision rows are written automatically whenever a sampled scorer runs:

```typescript
const agent = new Agent({
  // ...
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: 'openai/gpt-5-mini' }),
      // Every eligible run writes a decision row: 'sampled' or 'declined'.
      sampling: { type: 'ratio', rate: 0.1 },
    },
  },
});
```

Old scoring-decision rows can be pruned with the `scores.scoringDecisions` retention policy.
