---
'@mastra/core': patch
---

Fixed `run.restart()` failing with "This workflow run was not suspended" when the process crashed while a nested workflow was being resumed. The nested run is now restarted and its resumed step re-runs with the original resume data instead of suspending again. Fixes [#25187](https://github.com/mastra-ai/mastra/issues/25187).
