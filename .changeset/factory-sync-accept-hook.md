---
'@mastra/factory': patch
---

Fixed synchronous `onAccepted` hook failures rejecting an already-committed Factory transition and skipping its `stage_moved` audit record. Synchronous throws are now isolated and logged the same way as asynchronous rejections.
