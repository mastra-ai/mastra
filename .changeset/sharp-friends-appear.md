---
'@mastra/core': minor
---

Added agent rollout and experimentation support — canary rollouts with auto-rollback and A/B experiments with fixed traffic splits. Allocation weights are fractional in `[0, 1]` and must sum to 1 per rollout. Version assignment is deterministic per-user via hash-based routing (32-bit hash normalized to a `[0, 1)` bucket). New `mastra_rollouts` storage domain tracks rollout lifecycle, and a background accumulator monitors scorer results to auto-rollback if scores drop below configured thresholds.
