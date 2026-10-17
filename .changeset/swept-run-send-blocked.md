---
'@mastra/core': patch
---

Fixed messages being lost when sent to a thread shortly after its abandoned suspended run was cleaned up. Such a send used to return `deliver` while nothing received the message; it now returns `blocked`, as it did while the run was parked. Retry the send, and once the old run's lease expires (15 seconds by default) it starts a new run.
