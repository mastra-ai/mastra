---
'@mastra/core': patch
---

Fixed `mastra.datasets.compareExperiments()` silently comparing only the baseline and one other experiment. Every ID in `experimentIds` now gets a result entry on each item (`null` when that experiment did not run the item). Duplicate IDs are ignored, and passing a `baselineId` that isn't one of `experimentIds` now throws instead of being ignored.

```ts
const comparison = await mastra.datasets.compareExperiments({
  experimentIds: ['exp-baseline', 'exp-prompt-v2', 'exp-new-model'],
  baselineId: 'exp-baseline',
});
// comparison.items[0].results has entries for all three experiments
```
