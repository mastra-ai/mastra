---
'@mastra/core': patch
---

Fixed `observe(runId, { offset })` replaying the whole run when the offset is at or past the end of the run's log on a transport that keeps old messages, such as Redis Streams. The observer now skips every event below the offset and receives events once the run reaches it.

`createEventedAgent` on a cross-process pubsub with the default in-memory server cache still re-sends events from before the offset. Its events aren't numbered there, because each process would count them separately, and Redis Streams can trim or partly replay its backlog, so they can't be skipped by position either. Mastra now logs a one-time warning in that case. Configure a server cache shared by every process, such as `RedisServerCache`, to resume evented agents from an offset.
