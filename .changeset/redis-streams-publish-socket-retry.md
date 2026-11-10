---
'@mastra/redis-streams': patch
---

Fixed publishes failing when the Redis connection dropped mid-write. A publish that fails with a closed socket, `ECONNRESET`, `EPIPE`, or a connection timeout now retries at the transport level for up to two minutes, as it already did while Redis was loading after a restart. If Redis wrote the event but the reply was lost, the retry appends it again, so subscribers can receive a duplicate delivery with the same event id.
