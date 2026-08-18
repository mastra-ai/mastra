---
'@mastra/core': minor
---

Added `modelSettings.timeout` so you can put a time limit on agent runs. Set `totalMs` to cap how long a whole run may take, including every reasoning step, tool call and retry, and `stepMs` to cap a single model call. Going over either limit fails with a `MastraTimeoutError`. A `totalMs` timeout ends the run outright, while a `stepMs` timeout moves on to the next model when you have configured fallback models, so a slow provider no longer stalls the run. Closes #15667
