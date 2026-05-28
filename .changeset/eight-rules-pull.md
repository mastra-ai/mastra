---
'@mastra/core': patch
---

Fixed internal execution workflow not using Mastra storage during agent generate and stream, which caused debug log noise when storage was configured.
