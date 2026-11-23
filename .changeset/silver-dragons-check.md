---
'@mastra/core': patch
---

Fixed notifications being recorded as delivered when the target thread could not accept the signal. A blocked delivery now stays pending and eligible for retry instead of being silently dropped. Retries depend on notification dispatch being enabled, and a record is marked `failed` once it reaches the delivery attempt limit.

A thread held by a run that is suspended (for example, waiting on a tool approval) keeps blocking delivery. With the default dispatch schedule (every minute) and the 5-attempt limit, a notification sent to such a thread is marked `failed` after about 5 minutes rather than waiting for the run to resume.
