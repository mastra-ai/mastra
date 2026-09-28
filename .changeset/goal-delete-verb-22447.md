---
'mastracode': patch
'@mastra/code-sdk': patch
---

A live goal no longer disappears on its own. Saving the goal used to double as deleting it whenever no goal happened to be loaded in memory — which also happens after a storage hiccup, after switching threads mid-goal, and in the instant a goal is being started — so a routine save could destroy an objective nobody asked to remove. Pressing Esc while the judge was evaluating was enough to trigger it. Saving now deletes only after an explicit clear; `/goal clear` still removes the goal and its older stored copy.

For anyone using `GoalManager` from `@mastra/code-sdk` directly: `clear()` followed by `saveToThread()` still deletes the goal. The only change is that a save with no goal loaded, and no `clear()` before it, no longer deletes. `deleteFromThread` is also available to delete directly.
