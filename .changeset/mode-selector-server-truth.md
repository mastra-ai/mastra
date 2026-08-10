---
'mastra': patch
---

Fixed the Mastra Code session mode selector drifting out of sync: it now tracks the server-confirmed mode, keeps showing the target mode while a switch is in flight, and returns to the actual mode when a switch fails.
