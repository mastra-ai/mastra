---
'@mastra/core': patch
'mastracode': patch
---

Move the Harness's follow-up queue onto the Session as `session.followUps` (a new `SessionFollowUps` class).

`SessionFollowUps` owns the FIFO of messages a user submits while a run is in progress, held until the active run finishes: `count`/`isEmpty`/`enqueue`/`dequeue`/`requeue`/`clear`. The Harness `followUpQueue` field is removed; the Harness still drives draining (sending each queued message and emitting `follow_up_queued` as the count changes) and keeps the `queuedFollowUps` display-state mirror.

`Harness.getFollowUpCount()` is removed (it was a pure pass-through); read `harness.session.followUps.count()` instead. Mastracode call sites (`agent-lifecycle.ts`, `status-line.ts`) and test mocks are repointed accordingly.
