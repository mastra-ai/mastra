---
'@mastra/core': patch
---

Fixed internal agent stream workflows so transient workflow runs skip workflow storage lookup and persistence. This prevents misleading "Cannot get workflow run. Mastra storage is not initialized" debug logs without adding internal `execution-workflow` runs to user workflow storage.
