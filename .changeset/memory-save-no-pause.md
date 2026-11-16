---
'@mastra/core': patch
---

Removed the 10 ms pause after every memory save. Saving messages no longer waits before the run continues. A new message stamped in the same millisecond as the stored answer before it now sorts after that answer instead of before it, so the next response no longer merges into the previous one.

A queued message handed to a run on another process is no longer stuck when that run's lease disappears after this process stopped watching the thread; it now starts its own run.
