---
'@mastra/core': patch
'@mastra/redis-streams': patch
---

Stopping workers no longer waits out each subscription's blocking read in turn.

`RedisStreamsPubSub` unsubscribing an idle subscription used to close the reader with a graceful `QUIT` that Redis only answers once the reader's in-flight `XREADGROUP ... BLOCK` returned, so a stop cost up to `blockMs` (1s by default) per subscription. It now cancels that read with `CLIENT UNBLOCK` before closing, which returns the read immediately, while a reply that was already on its way is still drained as before. `Mastra.stopWorkers()` also unsubscribes its user event listeners concurrently instead of one at a time, so an idle shutdown pays that wait once at most. Shutdowns and rolling deploys are quicker.
