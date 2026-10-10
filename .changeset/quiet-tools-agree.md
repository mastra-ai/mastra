---
'@mastra/core': patch
---

Fixed agents being told to call `updateWorkingMemory` when `workingMemory.agentManaged` is `false`. The tool is not available in that mode, so agents now receive the read-only working memory instruction instead (#25896).
