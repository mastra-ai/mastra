---
'@mastra/memory': patch
---

Fixed Observational Memory calls continuing after an agent run is cancelled. Synchronous observation and reflection now stop with their run and leave the run's messages unobserved for a later cycle. Async buffering and background reflection keep running after the run is cancelled, and `settled()` still waits for them; only the run's own waits on that work stop. Fixes #27792.
