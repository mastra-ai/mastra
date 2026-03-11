---
"@mastra/core": patch
---

Fixed exponential backoff delay in `fetchWithRetry` being multiplied by 1000 twice, causing retries to wait 33+ minutes instead of the intended maximum of 10 seconds.
