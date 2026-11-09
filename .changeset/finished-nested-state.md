---
'@mastra/core': patch
---

Fixed nested workflows losing their state changes after a crash. When the process stopped after a nested workflow had finished but before its parent saved that, restarting the parent used the nested workflow's output but dropped the changes it made to the workflow state.
