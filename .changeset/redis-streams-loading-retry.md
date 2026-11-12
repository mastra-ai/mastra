---
'@mastra/redis-streams': patch
---

Fixed lost events and stuck evented agent runs when Redis restarts and reloads its dataset. Publishing now waits for Redis to finish loading (up to 2 minutes) instead of failing with a `LOADING` error, and the lease provider reports that Redis is refusing every client while it loads, so runs wait for it instead of treating their thread lease as lost.
