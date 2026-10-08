---
'@mastra/core': patch
---

Fixed nested workflows losing the parent's state when a run restarted before the nested workflow's first step finished. After a crash in that window, the nested workflow restarted with empty state instead of the state the parent passed in, so steps reading that state failed. The nested workflow now restarts with the parent's state.
