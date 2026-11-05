---
'@mastra/convex': patch
---

Kept iteration results saved before `workflow.step.end` when concurrent foreach iterations update the same step, matching `@mastra/core`'s snapshot merge.
