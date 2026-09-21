---
'@mastra/core': patch
---

Fixed goals that never ended after reaching their evaluation budget while waiting for user input. Once a goal uses all of its `maxRuns` evaluations, later chat turns now park it as `paused` with the budget reason. Previously they reported it as still running and rendered a `continue` verdict on every turn. Raise `maxRuns` and resume the goal to continue it.
