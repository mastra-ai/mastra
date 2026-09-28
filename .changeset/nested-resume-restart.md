---
'@mastra/core': patch
---

Fixed `run.restart()` on the default workflow engine after a process crash during a nested workflow resume. Restart no longer fails with "This workflow run was not suspended", and the resumed step keeps its resume data and completes instead of suspending again. Fixes [#25187](https://github.com/mastra-ai/mastra/issues/25187).

Fixed `timeTravel()` ignoring resume values such as `false` or `0`.
