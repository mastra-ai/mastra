---
'mastracode': patch
'@mastra/code-sdk': patch
---

A routine goal save could delete a live goal. Saving used to double as deleting whenever no goal happened to be loaded in memory. That also happens after a storage hiccup, after switching threads mid-goal, and in the instant a goal is being started, so a save nobody meant as a delete could remove the objective. Saving now deletes only after an explicit clear; `/goal clear` still removes the goal and its older stored copy.

For anyone using `GoalManager` from `@mastra/code-sdk` directly: `clear()` followed by `saveToThread()` still deletes the goal. The only change is that a save with no goal loaded, and no `clear()` before it, no longer deletes. `deleteFromThread` is also available to delete directly.
