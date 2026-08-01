---
'@mastra/core': patch
---

Fixed dataset item saving for traces with failed or suspended tool calls that have no recorded results. These dataset items now save successfully; missing tool results are stored as `null` instead of being omitted.
