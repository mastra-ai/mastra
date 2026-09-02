---
'@mastra/core': patch
---

`runEvals` now honours the trajectory contract in both gate loops. A scorer created with `type: 'trajectory'` is typed as receiving `output: Trajectory`, and the `scorers.trajectory` path already resolved one and threaded `expectedTrajectory`; the top-level `gates` loop and the per-turn `turns[].gates` loop passed the raw target output and no `expectedTrajectory`, so such a gate scored 0 on every item as soon as it read a trajectory field. Workflow targets resolve the trajectory from step results, matching the scorer path, instead of being handed the workflow's own result. Gate failures are also no longer silent: a throwing gate still scores 0, but the cause is logged with the gate id instead of being discarded by a bare `catch`.
