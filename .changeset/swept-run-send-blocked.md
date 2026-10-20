---
'@mastra/core': patch
---

Fixed messages being lost when sent to a thread shortly after the same instance cleaned up the thread's abandoned suspended run. Such a send used to return `deliver` while nothing received the message; it now returns `blocked`. Retry the send, and once the old run's lease expires (15 seconds by default) it starts a new run.
