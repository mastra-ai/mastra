---
'@mastra/memory': patch
---

Deleting a thread with `memory.deleteThread()` now also deletes the thread's live event stream from the Mastra pubsub (for example, Redis). Before, a deleted thread's stream stayed in Redis until it expired, or forever if the pubsub had no expiry.
