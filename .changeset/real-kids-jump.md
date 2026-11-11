---
'@mastra/core': patch
---

Fixed `run.restart()` on evented workflows failing with "This workflow run was not active" when a nested workflow had already finished before the restart. The parent now reuses the nested workflow's saved result and continues from the next step, as the default engine does. A nested workflow that had failed now fails the parent with its own error.
