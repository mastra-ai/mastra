---
'@mastra/core': patch
---

Fixed agent turns stopping early when an awaited background tool returns no result. The agent now sends `null` to the model and continues.
