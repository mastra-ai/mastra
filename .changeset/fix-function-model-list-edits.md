---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed Studio's Models panel silently ignoring reorder, enable/disable, and model changes when an agent's `model` is a function returning a fallback array. `agent.reorderModels()` and `agent.updateModelInModelList()` are now async, resolve function-valued models, and return whether the change was applied. Entries without an `id` in a function-returned list now get stable ids across calls. The model list routes now return an error instead of a success response when an edit cannot be applied.
