---
'@mastra/core': patch
'@mastra/pg': patch
---

Fixed terminal handoff settlement races in Harness v1 sessions.

- A terminal resume that joins a shared commit re-drives settlement instead of stranding the admission.
- Undeliverable re-suspension cancels the durable admission before it clears the recovery marker.
- An oversized suspension payload cancels the deferred admission instead of leaving it pending.
- A stale settlement retry can no longer overwrite a newer `switchMode`.
- Goal judging runs once per settled run.
- A replayed cached suspension can no longer resurrect a cleared or superseded pending interaction.
- A suspended caller joining a commit that is cancelled now receives the cancellation instead of waiting forever.
- Reopening a session no longer recounts usage a suspended run already recorded durably.
- Cancelling an already-fenced admission reports `fenced` instead of claiming a `cancelled` transition storage never made.
- A late commit on a fenced admission with a cancellation tombstone now surfaces the fence instead of a stale `cancelled` receipt.
- A storage failure while probing a suspended run's admission now notifies retained terminal observers instead of stranding them.
- Plan-approval recovery replays the persisted transition so an approved plan's target mode is restored after a crashed respond.
