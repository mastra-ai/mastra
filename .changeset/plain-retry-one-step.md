---
'@mastra/core': patch
---

Fixed agents losing token usage and reporting an extra step when a stream error is retried. When the model stream failed mid-reply and an error processor retried it, the default agent loop reported the failed attempt as its own step, and the run's `usage` lost its input, output and total token counts. The retry now happens inside the same step, the same as on durable and evented agents: the run reports one step, `onStepFinish` and `step-finish` fire once, and usage holds the successful attempt's token counts. Tool calls, sources and files from the failed attempt no longer show up on the recovered step.
