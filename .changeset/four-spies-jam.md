---
'@mastra/core': patch
---

Fixed evented workflow snapshots to store the final output value when runs complete successfully.

Fixed evented workflow streams to subscribe before start and resume events are published, so resumed step updates are not missed.
