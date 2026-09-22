---
'mastracode': patch
'@mastra/code-sdk': patch
---

A live goal no longer disappears on its own. Saving the goal used to double as deleting it whenever no goal happened to be loaded in memory — which also happens after a storage hiccup, after switching threads mid-goal, and in the instant a goal is being started — so a routine save could destroy an objective nobody asked to remove. Pressing Esc while the judge was evaluating was enough to trigger it. Saving now only ever writes; `/goal clear` still removes the goal and its older stored copy.

For anyone using `GoalManager` from `@mastra/code-sdk` directly: `saveToThread` no longer deletes when there is no goal in memory. Use the new `deleteFromThread` to delete.
