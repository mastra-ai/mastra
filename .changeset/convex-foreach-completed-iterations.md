---
'@mastra/convex': patch
---

Kept foreach iteration results saved before `workflow.step.end` when concurrent iterations update the same step, matching `@mastra/core`'s snapshot merge.
