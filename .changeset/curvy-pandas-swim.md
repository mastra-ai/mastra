---
'@mastra/memory': patch
---

Observational memory now includes the abort's reason when a run is stopped during observation, e.g. `Agent execution was aborted: Thread run … lost its lease before publishing a terminal event` instead of only `Agent execution was aborted`.
