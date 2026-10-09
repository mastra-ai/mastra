---
'@mastra/core': patch
---

Fixed evented workflows losing state changes after a restart. When a workflow run on the evented engine was restarted after a crash, steps resumed with the state from the run's start (or last suspension) instead of the state produced by the steps that already finished, so any `setState` updates made since then were lost. The workflow state is now recorded together with each step's result, and restarts resume from it.
