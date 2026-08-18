---
'@mastra/factory': patch
---

Stop the GitHub event worker from crashing when it is constructed before source-control storage is initialized.

`workers()` dereferenced the integration's source-control storage eagerly while building the reconcile worker, but that storage is only attached later by `versionControl.initialize`. A deployment that constructs workers first crashed with "source-control storage has not been initialized". The worker now receives a lazy handle that resolves the storage slices at call time, once the worker is actually running.
