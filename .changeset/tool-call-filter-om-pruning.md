---
'@mastra/core': patch
---

Fixed `ToolCallFilter` removing tool results from the current run after Observational Memory pruned messages mid-run or a suspended run was resumed. The filter now keeps those results so the model can still use them.
