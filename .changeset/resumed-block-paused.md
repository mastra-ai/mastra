---
'@mastra/core': patch
---

Fixed parallel and conditional blocks reporting `suspended` after a `perStep` resume left every branch `paused`. The run now reports `paused` instead of a `suspended` state with no steps that can be resumed.
