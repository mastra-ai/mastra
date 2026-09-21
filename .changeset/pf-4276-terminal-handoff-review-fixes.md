---
'@mastra/core': patch
---

Fixed Harness terminal handoff correctness: a grant generation now binds to a single admission across the harness, cancellation resolves the grant-wide winner before tombstoning, delivery intents are namespaced by the durable admission identity, live duplicates wait behind the durable commit barrier, suspended message runs defer terminal settlement until the approval-gated resume commits the real outcome, error finishes commit `failed` terminal results with a projected public error, terminal intent comparisons ignore the committer wall-clock `completedAt`, a committed admission replays its durable receipt instead of conflicting, session incarnations are minted whenever terminal handoff is enabled, and a reservation stranded before terminal admission is re-driven on retry.
