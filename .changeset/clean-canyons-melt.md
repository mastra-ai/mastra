---
'@mastra/core': patch
---

Fixed provider-reported cost on model generation spans when an agent run pauses on a tool approval or `suspend()` and then resumes. The paused part of the run now records its own cost, and the resumed part no longer repeats the cost of the steps that ran before the pause.
