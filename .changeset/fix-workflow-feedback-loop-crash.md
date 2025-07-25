---
'@mastra/core': patch
---

Fix workflow feedback loop crashes by preventing resume data reuse

Fixes an issue where workflows with loops (dountil/dowhile) containing suspended steps would incorrectly reuse resume data across iterations. This caused human-in-the-loop workflows to crash or skip suspend points after resuming.

The fix ensures resume data is cleared after a step completes (non-suspended status), allowing subsequent loop iterations to properly suspend for new input.

Fixes #6014