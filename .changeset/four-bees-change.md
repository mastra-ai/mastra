---
"@mastra/core": patch
---

Fixed `fetchWithRetry` continuing to retry cancelled requests. Cancellation now stops retry attempts and interrupts backoff immediately, preserving the caller's cancellation reason.
