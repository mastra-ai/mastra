---
'@mastra/inngest': patch
---

Inngest durable agents now stop steps running on other workers when `modelSettings.timeout.totalMs` expires. Previously only the process that started the run stopped at the deadline; a tool already running on a separate Inngest worker kept going and the run could call the model again. Now the tool's `abortSignal` fires with a `MastraTimeoutError` on whichever worker runs it, the run makes no further model calls, and the caller still receives exactly one `MastraTimeoutError`. A step that first reaches a worker after the deadline stops there too, because the deadline travels with the run. A tool that ignores its `abortSignal` no longer holds the run open: once the abort grace period passes, its step is saved with the aborted-tool notice, the same as a tool that returns after the deadline.
