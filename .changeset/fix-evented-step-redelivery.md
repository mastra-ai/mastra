---
'@mastra/core': patch
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Fixed long-running evented workflow steps running twice when the broker redelivers the step event before the step finishes. Workers now send a heartbeat while a step runs, so the broker does not hand the event to another worker. Each step run is also fenced with a lease, so a redelivered copy is dropped while the original is still running. Redis Streams and Valkey Streams support the heartbeat. Steps should still be idempotent, because a worker crash can still cause a step to run again.
