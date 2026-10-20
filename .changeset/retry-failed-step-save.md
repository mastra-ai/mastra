---
'@mastra/core': patch
---

Fixed lost messages when a per-step save fails. With `savePerStep` enabled, a failed write used to drop the drained messages from the unsaved set, so no later save wrote them and the user's message or the step's output disappeared from the thread. Failed saves now mark those messages unsaved again, and the next save writes them.
