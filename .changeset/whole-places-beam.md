---
'mastra': patch
---

Fixed server deploy getting permanently stuck in 'queued' status when the upload confirmation step fails. The CLI now retries transient failures (5xx, 401) up to 3 times with exponential backoff, and automatically cancels orphaned deploys when upload or confirmation fails. Added user-visible log messages during retries and cleanup so deploy failures are no longer silent.
