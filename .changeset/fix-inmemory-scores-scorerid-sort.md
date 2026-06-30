---
'@mastra/core': patch
---

Fix in-memory scores store `listScoresByScorerId` returning scores in insertion order instead of newest first. The pg and libsql adapters order by `createdAt DESC`, and the sibling `listScoresBySpan` already does, so the in-memory store now sorts the same way before paginating. Closes #18618.
