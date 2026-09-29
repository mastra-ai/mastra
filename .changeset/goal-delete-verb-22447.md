---
'mastracode': patch
'@mastra/code-sdk': patch
---

A routine goal save could delete a live goal. Saving used to double as deleting whenever no goal happened to be loaded in memory, so an empty ordinary save could remove the objective without explicit deletion intent. Saving now deletes only after an explicit clear; `/goal clear` still removes the goal and its older stored copy. If that delete fails, `/goal clear` now reports that the goal is still active instead of claiming success, and switching back to the thread retries the delete rather than silently restoring the goal.

For anyone using `GoalManager` from `@mastra/code-sdk` directly: `clear()` followed by `saveToThread()` on the same thread still deletes the goal. The only change is that a save with no goal loaded, and no `clear()` before it, no longer deletes. `deleteFromThread` is also available to delete directly, and resolves to whether the delete landed:

```ts
await goalManager.deleteFromThread(state);
```
