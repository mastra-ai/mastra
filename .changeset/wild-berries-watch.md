---
'@mastra/core': patch
---

Fix `runEvals()` to automatically save scores to storage, making them visible in Studio observability.

Previously, `runEvals()` would calculate scores but not persist them to storage, requiring users to manually implement score saving via the `onItemComplete` callback. Scores now automatically save when the target (Agent/Workflow) has an associated Mastra instance with storage configured.

**What changed:**
- Scores are now automatically saved to storage after each evaluation run
- Fixed compatibility with both Agent (`getMastraInstance()`) and Workflow (`.mastra` getter)
- Saved scores include complete context: `groundTruth` (in `additionalContext`), `requestContext`, `traceId`, and `spanId`
- Scores are marked with `source: 'TEST'` to distinguish them from live scoring

**Migration:**
No action required. The `onItemComplete` workaround for saving scores can be removed if desired, but will continue to work for custom logic.

**Example:**
```typescript
const result = await runEvals({
  target: mastra.getWorkflow("myWorkflow"),
  data: [{ input: {...}, groundTruth: {...} }],
  scorers: [myScorer],
});
// Scores are now automatically saved and visible in Studio!
```
