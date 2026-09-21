---
'mastracode': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Keep the reason a goal paused visible after it pauses. The runtime already computed a pause cause (evaluation budget exhausted, judge failure), but it was dropped on the way into the in-memory goal view, on the way through the SDK persistence API, and on the legacy thread-metadata load path, so `/goal status` and the goal modal could only say "paused". The cause is now threaded through all three seams and rendered, and it is retired when the goal leaves the paused state so a later pause cannot inherit a stale reason.

Note for server consumers: `Agent.updateObjectiveOptions` now drops a stored pause reason whenever the resulting status is not `paused`, so resuming a goal through the agent goal route clears the reason along with the paused status.
