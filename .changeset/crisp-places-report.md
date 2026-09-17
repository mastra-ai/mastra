---
'@mastra/code-sdk': patch
---

Fixed low-priority fire-and-forget signals being reported as failed after they were queued for notification summaries. Summarized reply requests now persist the notification but return a clear error instead of falsely recording a reply obligation, so callers can send a new request at a priority that routes directly. Policy-discarded signals remain retryable.
