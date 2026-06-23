---
'@mastra/core': patch
---

Fixed a crash when the goal judge stream outlives the main agent stream. The `emitJudgeActivity` helper now uses `safeEnqueue` (try/catch guard) instead of raw `controller.enqueue()`, preventing `TypeError: Controller is already closed` when the ReadableStream controller closes before the fire-and-forget judge observer finishes draining.
