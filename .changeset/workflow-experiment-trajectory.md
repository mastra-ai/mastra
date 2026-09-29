---
'@mastra/core': patch
---

Fixed trajectory scorers in dataset experiments receiving an empty trajectory for workflow targets when no trace is stored. They now receive the workflow's executed steps, matching `runEvals`.
