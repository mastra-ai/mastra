---
'@mastra/core': patch
---

Fixed servers staying busy forever after using deferred notifications. A saved notification dispatch schedule no longer starts the scheduler on boot unless a deferred notification is still waiting. The once-a-minute dispatch schedule now removes itself after it delivers the last pending notification, and the next deferred notification brings it back.
