---
'@mastra/core': patch
---

Fixed Evented Agent Controller runs that execute on a separate worker. The worker rebuilds the controller context and configured tools so Factory sessions can complete their turns.
