---
'@mastra/core': patch
---

Fixed workflow cancellation for tool-wrapped steps. Cooperative tools can now stop early when `run.cancel()` is called. Fixes #19599.
