---
'@mastra/redis-streams': patch
---

`inFlightTimeoutMs` now settles a timed-out entry atomically. The ownership check and the republish + `XACK` run in a single Redis script, so a sibling consumer claiming the entry between the two can no longer cause a duplicate republish or an `XACK` of the sibling's pending entry.
