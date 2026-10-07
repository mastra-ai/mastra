---
'@mastra/core': patch
---

Fixed `ToolCallFilter` removing tool calls and results from the current run when observational memory removed earlier messages mid-run. The model now keeps the results it just produced, while tool calls from earlier turns are still filtered. Fixes #25886.
