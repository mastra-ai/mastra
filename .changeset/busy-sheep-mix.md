---
'@mastra/core': minor
---

Added item-level scorer selection for dataset experiments.

Dataset items now accept `scorerIds`. Experiments select one scorer source in this order: explicitly provided run-level scorers, item scorer IDs, then dataset scorer IDs. Use `[]` at the run or item level to select no scorers.

```typescript
await dataset.addItem({
  input: 'Evaluate this response',
  scorerIds: ['accuracy'],
});

await dataset.updateItem({
  itemId: 'item-id',
  scorerIds: null,
});
```

Omit `scorerIds` to inherit or preserve the current override, use `[]` to run no scorers for an item, and update with `null` to restore dataset inheritance. Missing item-level scorer IDs fail only the affected item before target execution.

Run-level scorers now replace dataset-attached defaults instead of merging with them. Previously, this configuration ran both `latency` and the dataset's `accuracy` scorer:

```typescript
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  scorers: ['latency'],
});
```

It now runs only `latency`. To keep both scorers, provide both in the run-level list:

```typescript
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  scorers: ['latency', 'accuracy'],
});
```
