---
'@mastra/core': patch
---

Fixed evented workflows slowing down as more runs are in flight. Each run started with `start()` or `startAsync()` used to open its own listener for finish events, so every finished run was handed to every waiting run and total work grew with the square of concurrent runs. Runs now share one listener and each finish reaches only its own caller.

Fixed evented runs staying `running` forever when the pubsub broker was unreachable while they were being started. If the start event never reaches a worker, the run is now recorded as `failed` with the error, and `start()`/`startAsync()` still reject as before.
