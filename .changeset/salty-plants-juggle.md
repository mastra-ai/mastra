---
'@mastra/core': patch
---

Fixed thread resume delivery so new runs after aborts keep their queued context instead of dropping messages.
