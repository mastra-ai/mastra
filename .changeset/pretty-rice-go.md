---
'@mastra/core': minor
---

Added an awaited semantic event observer for experiments.

Use `onEvent` to consume versioned, JSON-safe run and item lifecycle events in strict sequence order:

```ts
await runExperiment(mastra, {
  task: async ({ input }) => processItem(input),
  data: items,
  onEvent: async event => {
    await publish(event);
  },
});
```

Terminal events are delivered before final experiment status persistence, allowing external workers to treat the ordered event stream as authoritative. Observer failures stop the run with an `EXPERIMENT_EVENT_OBSERVER_FAILED` error so workers can distinguish delivery failures from partial experiment results.
