---
'@mastra/core': patch
---

A message sent right after an abort (a steer, or a follow-up typed while the run is stopping) now waits up to 30 s for the aborted run to finish tearing down before it is dispatched. Real teardown includes stream cancellation and the output processors that run on the partial result, which takes longer than the previous one-second cap; dispatching earlier handed the new message to the dying run, which dropped it, so a steer produced no reply. A deferred abort behind a parked approval gate keeps its short wait, since nothing is streaming there.
