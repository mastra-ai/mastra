---
'@mastra/code-sdk': patch
---

Fixed low-priority fire-and-forget signals being reported as failed after they were queued for notification summaries. Reply-required signals must use medium or higher priority so the recipient receives the obligation directly, and policy-discarded signals remain retryable.
