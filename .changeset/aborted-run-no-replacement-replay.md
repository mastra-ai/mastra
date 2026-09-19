---
'@mastra/core': patch
---

Fixed a replacement thread subscription replaying a run that was aborted but never terminalized. `abortRun` leaves the run in `activeThreadRunIds` until the runtime terminalizes it, so a consumer that aborts and tears its subscription down in the same tick (what `SessionStream.cleanup()` does) leaves nobody to observe `run-aborted`. The next `subscribeToThread` seeded itself with that stopped run and replayed its buffered chunks, which surfaced as a second `agent_start` and a second terminal lifecycle after `agent_end(aborted)` — and parked the new subscriber on a stream that never ends, so the follow-up that opened it was never delivered. A subscription no longer seeds from an aborted run; later runs on the thread still seed and stream normally. Fixes #24174
