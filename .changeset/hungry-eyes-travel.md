---
'@mastra/redis-streams': patch
---

Fixed `close()` hanging forever when a Redis connection was reconnecting at shutdown. A brief Redis outage just before shutdown could keep the process from exiting, even after Redis came back.
