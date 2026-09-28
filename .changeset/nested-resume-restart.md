---
'@mastra/core': patch
---

Fixed `run.restart()` on the default workflow engine failing with "This workflow run was not suspended" when the process crashed while a nested workflow was being resumed. The nested run is now restarted or resumed based on its own saved status, and its resumed step re-runs with the original resume data instead of suspending again. Fixes [#25187](https://github.com/mastra-ai/mastra/issues/25187).

Also fixed `timeTravel()` ignoring falsy resume data such as `false` or `0`.
