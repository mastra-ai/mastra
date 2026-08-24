---
'@mastra/core': patch
---

Fixed experiments dropping a dataset item's expected trajectory. `dataset.startExperiment` and `runExperiment` now pass each item's `expectedTrajectory` to trajectory scorers, so a trajectory that matches the expectation scores correctly instead of always scoring 0. Inline experiment data can now supply `expectedTrajectory` too. Fixes #21743
