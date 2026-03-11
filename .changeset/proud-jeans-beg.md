---
'@mastra/core': patch
---

Fixed exponential backoff delay in fetchWithRetry that was multiplied by 1000 twice, causing retries to always hit the 10-second cap instead of properly scaling from 2s → 4s → 8s → 10s.
