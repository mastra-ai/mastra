---
'@mastra/core': patch
---

Fixed `observe(runId, { offset })` replaying the whole run when the offset is at or past the end of the run's log on a transport that keeps old messages, such as Redis Streams. While the run's log is retained, the observer now skips every event below the offset and receives events once the run reaches it. If the log expired or was cleared and the run starts numbering again from 0, the observer resyncs and receives the new events from the start.

`createEventedAgent` can still re-send events from before the offset when processes share a pubsub such as Redis Streams but each uses the default in-memory server cache. Mastra now logs a one-time warning when this happens. To resume evented agents from an offset, configure a server cache that every process shares, such as `RedisServerCache`.
