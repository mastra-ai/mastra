---
'@mastra/core': patch
---

Fixed a message sent to a thread in the window after the suspended-run TTL sweep being silently dropped: the sweep evicts a parked run but deliberately leaves its thread lease, and a sendMessage/sendSignal inside that window was acknowledged as deliver to the evicted run while nothing received or persisted it. Such a send now returns blocked with the holding run id so the caller can act, and a send after the lease frees wakes a new run as before. Fixes #26474
