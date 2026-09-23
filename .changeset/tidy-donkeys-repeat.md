---
'@mastra/core': patch
---

Fix an event-loop hang when a run starts immediately after a persisted idle signal. The synthetic run that rebroadcasts the signal resolved its completion promise before its deferred cleanup ran, so a same-thread run waiting on it re-awaited an already-resolved promise in an unbounded microtask loop — pinning a CPU core and stopping timers and HTTP process-wide. The waiter now yields to the timer queue when the same run is still active after its completion promise settles.
