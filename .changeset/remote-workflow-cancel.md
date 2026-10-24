---
'@mastra/core': patch
---

Fixed workflow cancellation from another process being overwritten. When `run.cancel()` was called from a different process (or another Mastra instance sharing the same storage), the original run kept going: the step that was running finished, later steps still ran, and the stored status changed from `canceled` to `success`. The default engine now checks storage for a cancellation after each step, stops before running more steps, and keeps the `canceled` status. Fixes [#27805](https://github.com/mastra-ai/mastra/issues/27805).
