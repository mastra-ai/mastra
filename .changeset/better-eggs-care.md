---
'@mastra/core': patch
---

Surface persistence failures in experiment runs. Previously, when `addExperimentResult` threw during `runExperiment`, the failure was silently logged with `console.warn` and the run continued. The item was still counted as succeeded or failed based on the agent run outcome, so `ExperimentSummary.succeededCount` could report more rows than actually existed in `mastra_experiment_results` — silent data loss with no signal to the caller.

Now each item result carries an optional `persistenceError: { message, stack? } | null` field, and the summary exposes an optional `persistenceFailures: number` counter. Target-run counters (`succeededCount` / `failedCount`) still reflect what the target did, and callers can inspect `persistenceFailures` to detect when the DB is out of sync with the returned summary and decide whether to retry or alert. The persistence failure is also logged via the Mastra logger at error level instead of `console.warn`.

Both fields are optional on the types so external mocks / wrappers don't need to hand-construct them; the runner always populates them (`null` / `0` on the happy path).

```ts
const summary = await runExperiment(mastra, { datasetId, targetType: 'agent', targetId: 'my-agent' });

if ((summary.persistenceFailures ?? 0) > 0) {
  const dropped = summary.results.filter(r => r.persistenceError != null);
  for (const item of dropped) {
    console.error(`item ${item.itemId} did not persist:`, item.persistenceError?.message);
  }
}
```
