---
'@mastra/core': patch
---

Fixed `subscribeToThread({ withInitialHistory: true })` returning `thread-history` messages newest first. The initial history now lists the newest page of messages oldest first, matching `listThreadMessages` and the documented behavior.
