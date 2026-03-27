---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Add `getReviewSummary()` to experiments storage for aggregating review status counts

Query experiment results grouped by experiment ID, returning counts of `needs-review`, `reviewed`, and `complete` items in a single query instead of fetching all results client-side.

```ts
const summary = await storage.experiments.getReviewSummary();
// [{ experimentId: 'exp-1', needsReview: 3, reviewed: 5, complete: 2, total: 10 }, ...]
```
