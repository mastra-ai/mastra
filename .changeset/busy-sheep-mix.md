---
'@mastra/core': patch
---

Added item-level scorer selection for dataset experiments.

Dataset items now accept `scorerIds`. Experiments select one scorer source in this order: explicitly provided run-level scorers, item scorer IDs, then dataset scorer IDs. Run-level scorers no longer merge with dataset-attached scorers.

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
