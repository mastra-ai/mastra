---
'@mastra/core': patch
---

Fixed a memory leak where suspended agent runs were never released from memory. Every suspend kept its full in-memory transcript retained for the life of the process, so long-running servers with many suspend/resume cycles grew unbounded and could eventually exhaust the heap.

Suspended runs are now kept warm only for a bounded window (30 minutes by default) and then evicted. A same-instance resume within that window still reattaches to the warm state exactly as before; a resume after the TTL expires falls back to the durable snapshot. Set `MASTRA_SUSPENDED_RUN_TTL_MS` (in milliseconds) to tune the window — lower it on multi-instance deployments where a resume rarely lands on the origin instance:

```sh
# keep suspended runs warm for 10 minutes instead of the default 30
MASTRA_SUSPENDED_RUN_TTL_MS=600000
```
