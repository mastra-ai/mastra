---
'@mastra/core': patch
---

Fixed agent runs failing when the goal judge's feedback signal could not be streamed (for example, because a durable agent's transport had closed). The verdict is still recorded and the run finishes normally.
