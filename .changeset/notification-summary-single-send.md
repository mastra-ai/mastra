---
'@mastra/core': patch
---

Fixed notification summaries being sent twice when two dispatch passes overlap, for example on multiple server instances or when a pass runs longer than the one-minute schedule. Each pass now claims a due summary before sending it, so only one pass sends it. If the send fails, the summary becomes due again and is retried. Summary signals also get a stable id derived from the notifications they cover.

Storage adapters can add an atomic `claimNotificationSummary` method. Adapters that don't add one fall back to a read-then-write claim.
