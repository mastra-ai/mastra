---
'@mastra/core': patch
---

Fixed goals silently stopping when more than one agent used them. A second agent's goal state could not reach storage, so its objective was never shown to the model. Fixed a goal being paused permanently when its judge hit a temporary error such as a dropped connection: the judge is now retried once, a judge that never answers is treated as a failure instead of "keep going", and an evaluation that produced no verdict no longer spends part of the run budget. Fixes #22446
