---
'@mastra/core': patch
---

Fixed observation of unknown and completed durable agent runs so streams close promptly after replaying retained events, including when the requested offset skips the final event or a completed workflow snapshot remains after cleanup. Observers stay attached when lifecycle state cannot be read.
