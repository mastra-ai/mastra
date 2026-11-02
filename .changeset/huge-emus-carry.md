---
'@mastra/temporal': patch
---

Fixed workflow lifecycle callbacks being ignored on Temporal-backed workflows (#24018). `onStart`, `onFinish` and `onError` now run in the process that calls `run.start()` or `run.startAsync()`. An `onStart` that throws rejects the start before the run reaches Temporal. `run.start()` now returns `canceled` instead of `failed` for a canceled workflow, and `onError` doesn't run for it.
