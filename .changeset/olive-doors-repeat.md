---
'@mastra/core': patch
---

Fix two workflow reporting bugs that surface in Studio's workflow graph.

Step timings are now captured inside the durable operation instead of around it. On replay-based engines (`@mastra/inngest`) the workflow function body re-runs from the top after every completed step and finished steps are served from the memo, so the surrounding `Date.now()` readings timed the replay rather than the execution — completed steps and sub-workflows collapsed to single-digit-millisecond durations in the persisted snapshot regardless of how long they really took.

Parallel branches now persist each child as it settles. `executeParallel` pre-marks every child `running` and only the surrounding `executeEntry` persisted, after the join — so `getWorkflowRunById` reported already-finished children as `running` until the slowest sibling landed, and the graph showed completed steps still spinning.
