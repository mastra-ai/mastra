---
'@mastra/mongodb': patch
---

Fixed `storage.prune()` on MongoDB deleting a document that was updated while the prune was running. A document that is no longer older than `maxAge` when its batch is deleted is now kept.
