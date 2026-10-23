---
'@mastra/core': patch
---

Fixed `observe(runId, { offset })` replaying the whole run when the offset is at or past the end of the run's log on a transport that keeps old messages, such as Redis Streams. The observation now starts at the end of the log and only receives new frames.

When frames reaching an offset subscriber are not numbered (for example `createEventedAgent` on a cross-process pubsub without a shared server cache), Mastra now logs a one-time warning recommending a shared server cache such as `RedisServerCache`, since those frames cannot be skipped by position.
