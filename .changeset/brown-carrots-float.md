---
'@mastra/core': patch
---

Fixed goals that reached their evaluation budget while waiting for user input never ending. After a goal used all of its `maxRuns` evaluations, later chat turns now park it as `paused` (with the budget reason) instead of reporting it as still running and rendering a `continue` verdict on every turn. Raise `maxRuns` and resume to continue the goal.
