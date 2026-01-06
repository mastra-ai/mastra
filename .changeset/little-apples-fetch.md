---
'@mastra/core': patch
---

Fix race condition in parallel tool stream writes

Introduces a write queue to ToolStream to serialize access to the underlying stream, preventing writer locked errors
