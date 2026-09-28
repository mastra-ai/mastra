---
'mastracode': patch
'@mastra/code-sdk': patch
---

A routine goal save could delete a live goal. Saving used to double as deleting whenever no goal happened to be loaded in memory, so an empty ordinary save could remove the objective without explicit deletion intent. Saving now deletes only after an explicit clear; `/goal clear` still removes the goal and its older stored copy.

For anyone using `GoalManager` from `@mastra/code-sdk` directly: `clear()` followed by `saveToThread()` on the same thread still deletes the goal. The only change is that a save with no goal loaded, and no `clear()` before it, no longer deletes. `deleteFromThread` is also available to delete directly:

```ts
await goalManager.deleteFromThread(state);
```
