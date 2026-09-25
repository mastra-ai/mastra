---
'@mastra/server': patch
---

Fixed duplicate agent runs when multiple A2A streaming requests continue the same paused task. Later requests now receive the task's final state.
