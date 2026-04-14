---
'@mastra/core': minor
---

Added agent rollout and experimentation support — canary rollouts with auto-rollback and A/B experiments with fixed traffic splits. Version assignment is deterministic per-user via hash-based routing. New `mastra_rollouts` storage domain tracks rollout lifecycle, and a background accumulator monitors scorer results to auto-rollback if scores drop below configured thresholds.
