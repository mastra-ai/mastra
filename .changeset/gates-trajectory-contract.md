---
'@mastra/core': patch
---

`runEvals` now honours the trajectory contract in both gate loops. A scorer created with `type: 'trajectory'` is typed as receiving `output: Trajectory`, and the `scorers.trajectory` path already extracted one and threaded `expectedTrajectory`; the top-level `gates` loop and the per-turn `turns[].gates` loop passed the raw output messages and no `expectedTrajectory`, so a trajectory-typed scorer used as a gate saw a shape its own type says it will not receive and failed every item. Gate failures also no longer vanish: a throwing gate still scores 0, but the cause is now logged with the gate id instead of being discarded by a bare `catch`.
