---
'@mastra/redis-streams': patch
---

Fixed workflow runs that stayed `running` on Redis Streams when a worker shut down while one of their steps was still running. Another worker now runs that step again instead of skipping it.
