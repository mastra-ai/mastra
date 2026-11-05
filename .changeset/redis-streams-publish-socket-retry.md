---
'@mastra/redis-streams': patch
---

Fixed events being lost when the Redis connection dropped while publishing. A publish that failed with a closed socket, `ECONNRESET`, `EPIPE`, or a connection timeout now retries for up to two minutes, as it already did while Redis was loading after a restart. If Redis wrote the event but the reply was lost, the retry can deliver a second copy with the same event id.
