---
'@mastra/core': minor
---

Added `requestContext` support for dataset items and experiments.

**Dataset items** now accept an optional `requestContext` field when adding or updating items. This lets you store per-item request context alongside inputs and ground truths.

**Datasets** now support a `requestContextSchema` field to describe the expected shape of request context on items.

**Experiments** now accept a `requestContext` option that gets passed through to `agent.generate()` during execution. Per-item request context merges with (and takes precedence over) the experiment-level context.

```ts
// Add item with request context
await dataset.addItem({
  input: messages,
  groundTruth: expectedOutput,
  requestContext: { userId: '123', locale: 'en' },
});

// Run experiment with global request context
await runExperiment(mastra, {
  datasetId: 'my-dataset',
  targetType: 'agent',
  targetId: 'my-agent',
  requestContext: { environment: 'staging' },
});
```
