---
'@mastra/observability': patch
---

Fixed `keysToStrip.has is not a function` crash in `deepClean()` when bundlers transform `new Set([...])` into a plain object or array. This affected agents with memory deployed to Mastra Cloud.
