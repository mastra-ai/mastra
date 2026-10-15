---
'@mastra/core': patch
---

`Agent.reorderModels()` and `Agent.updateModelInModelList()` now return `true` when the edit was applied and `false` when it was not (no model list, unknown id, or a function-valued `model`). Function-valued models are left untouched so per-request model selection keeps working.

```ts
if (!agent.updateModelInModelList({ id, enabled: false })) {
  // edit was not applied
}
```
