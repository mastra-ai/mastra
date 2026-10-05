---
'@mastra/core': patch
---

Fixed `restart()` for evented workflows that crashed while resuming a nested workflow. The resumed step now keeps its resume data and completes on restart instead of suspending again. Fixes [#25365](https://github.com/mastra-ai/mastra/issues/25365).
