---
'@mastra/core': patch
---

Fixed terminal handoff settlement races in Harness v1 sessions: a terminal resume joining a shared commit promise now re-drives settlement instead of stranding the admission; undeliverable re-suspension cancels the durable admission before clearing the recovery marker; oversized suspension payloads cancel the deferred admission instead of leaving it pending; stale settlement retries can no longer overwrite a newer `switchMode`; and goal judging is deduplicated per settled run.
