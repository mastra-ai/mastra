---
"@mastra/core": minor
---

Add state signals for named thread context lanes. Use `agent.sendStateSignal()` for external producers, or processor `sendStateSignal()` and `computeStateSignal()` for processor-owned state. State producers provide an `id`, `cacheKey`, and `mode` so Mastra can dedupe active copies, version state on thread metadata, and pass `lastSnapshot` plus `deltasSinceSnapshot` into `computeStateSignal()`.
