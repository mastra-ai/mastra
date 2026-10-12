---
'@mastra/core': patch
---

Fixed excessive memory use when evented workflows finish by removing unused ancestor execution data from completion events and limiting queued Unix-socket publisher writes.
