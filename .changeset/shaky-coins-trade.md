---
'@mastra/core': patch
---

Fixed evented workflow runs that ran a step again and reported a second finish after they had already ended. This happened when a step event was delivered late, for example when the message broker handed an unacknowledged message from a stopped worker to another worker. A finished run now ignores such late step events, and a late failure or second end no longer changes a run that already finished.
