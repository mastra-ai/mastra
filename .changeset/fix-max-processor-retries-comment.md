---
'@mastra/core': patch
---

Corrected the `maxProcessorRetries` doc comment on per-call agent options. It said that leaving it unset meant no retries. In fact, error processors such as `StreamErrorRetryProcessor` are capped at 3 retries when no cap is set.
