---
'@mastra/core': patch
---

Fixed strict structured-output failures when using a separate structuring model. Failed requests now retry up to `maxProcessorRetries`. Warn and fallback behavior is unchanged.
