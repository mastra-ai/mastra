---
'@mastra/core': patch
---

Fixed terminal handoff settlement races in Harness v1 sessions.

- A terminal resume that joins a shared commit re-drives settlement instead of stranding the admission.
- Undeliverable re-suspension cancels the durable admission before it clears the recovery marker.
- An oversized suspension payload cancels the deferred admission instead of leaving it pending.
- A stale settlement retry can no longer overwrite a newer `switchMode`.
- Goal judging runs once per settled run.
