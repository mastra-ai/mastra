---
'@mastra/libsql': minor
---

Preserve durable workflow span checkpoints across concurrent updates and snapshot writes.

Checkpoint-capable workflow storage merges span snapshots independently and retains completed execution outcomes across late writes. This provides persistence for durable tracing handoff; Inngest uses these checkpoints for cancellation finalization.

Preserve the active execution-root pointer alongside span checkpoints across stale full-snapshot writes. Resume lineage can point to an older or external span without redirecting the active execution.
