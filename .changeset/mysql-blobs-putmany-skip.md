---
'@mastra/mysql': patch
---

Fixed `putMany` on the MySQL blob store overwriting existing blobs. Blobs whose hash is already stored are now skipped, matching `put` and the other storage adapters, so a blob keeps the `createdAt` of when it was first stored instead of being moved forward on every skill republish.
