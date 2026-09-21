---
'@mastra/core': patch
---

Fixed Harness terminal handoff correctness.

- A grant generation now binds to a single admission across the harness.
- Cancellation resolves the grant-wide winner before tombstoning.
- Delivery intents are namespaced by the durable admission identity.
- Live duplicates wait behind the durable commit barrier.
- Suspended message runs defer terminal settlement until the approval-gated resume commits the real outcome.
- Error finishes commit `failed` terminal results with a projected public error.
- Terminal intent comparisons ignore the committer wall-clock `completedAt`.
- A committed admission replays its durable receipt instead of conflicting.
- Session incarnations are minted whenever terminal handoff is enabled.
- A reservation stranded before terminal admission is re-driven on retry.
