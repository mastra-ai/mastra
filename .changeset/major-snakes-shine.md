---
'@mastra/inngest': minor
---

Added native outcomes and typed stop-reason context to workflow roots, steps, and control-flow spans. Completed suspension and subsequent resume retain separate execution identities across worker replacement. Nested guardrails preserve their cause, and memoized failure completion prevents duplicate exports during replay.

Late cancellation preserves completed workflow state, including completion while the cancellation request is in flight. Atomic protection requires a store with concurrent update support. Cancellation closes checkpointed workflow roots, steps, and control-flow spans through the configured exporter, including after replacement of a waiting worker. This requires persisted snapshots and checkpoint-capable workflow storage (in-memory, LibSQL, or PostgreSQL). Finalization cannot reopen canceled state after a delayed lifecycle callback. Parent cancellation propagates to checkpointed nested runs, including concurrent foreach children, while preserving completed children. Cancellation recorded before child dispatch prevents that child from executing. This requires persisted pending snapshots for both parent and child. Active ownership transfer remains separate work.
