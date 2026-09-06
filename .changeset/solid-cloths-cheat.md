---
'@mastra/core': patch
---

Improved `runEvals` so execution and scoring failures are returned as ordered entries in `result.items` instead of rejecting the entire batch. The result summary now includes `succeededItems` and `failedItems`, and failed items retain trace links when observability is enabled. Structured tool-validation errors are also marked as unsuccessful trajectory steps.

`onItemComplete` now receives a discriminated outcome for both successful and failed items. `targetResult` is available only when `status` is `"success"`, so callers must narrow on `status` before accessing it.

```ts
const result = await runEvals({
  target,
  data,
  scorers,
  onItemComplete: outcome => {
    if (outcome.status === 'success') {
      console.log(outcome.targetResult);
    } else {
      console.error(outcome.phase, outcome.error);
    }
  },
});

for (const item of result.items) {
  if (item.status === 'failed') console.error(item.error);
}
console.log(result.summary.failedItems);
```
