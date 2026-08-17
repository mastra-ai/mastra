---
'@mastra/redis-streams': patch
---

Fixed subscribe() creating Redis streams without a TTL. When streamIdleTtlMs is configured, the stream key created via MKSTREAM is now stamped with the TTL atomically, so topics that are subscribed to but never published to (for example per-run control topics) no longer linger in Redis forever.
