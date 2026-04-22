---
'@mastra/server': patch
---

Fixed screencast panel staying "Live" after browser closes due to an error. The `ViewerRegistry` now broadcasts `browser_closed` status when a screencast stream emits an error, not just when it stops cleanly.
