---
'@mastra/core': patch
---

Fixed pausing, clearing, or replacing a goal while its judge is running being silently undone. The judge's verdict is now discarded when the objective changed during evaluation, so the agent stops instead of continuing a goal you already stopped.
