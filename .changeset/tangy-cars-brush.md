---
'@mastra/core': patch
---

Fixed EventEmitterPubSub so publish() no longer rejects when a subscriber throws synchronously; the error is logged and delivery continues.
