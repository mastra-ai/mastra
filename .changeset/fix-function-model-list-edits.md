---
'@mastra/core': patch
---

Fixed model list edits being silently ignored when an agent's `model` is a function returning a fallback array. Entries without an `id` in a function-returned list now get stable ids across calls.

`agent.reorderModels()` and `agent.updateModelInModelList()` now return a promise that resolves to whether the edit was applied. Await them:

```ts
// Before
agent.reorderModels(ids);

// After
const applied = await agent.reorderModels(ids);
if (!applied) {
  // the agent has a single model, or no matching entry was found
}
```
