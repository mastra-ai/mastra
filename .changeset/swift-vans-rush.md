---
'@mastra/pg': minor
---

Added workflow span checkpoint storage for durable tracing handoff. Checkpoint-capable stores merge concurrent siblings independently, preserve completed snapshots, and retain checkpoints across full workflow snapshot writes. Inngest uses these checkpoints for cancellation handoff; evented workers use them for root identity and completion.

Preserve the active execution-root pointer alongside span checkpoints across stale full-snapshot writes. Resume lineage can point to an older or external span without redirecting the active execution.
