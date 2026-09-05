---
'@mastra/convex': patch
---

Fixed workflow snapshot saves to preserve their original creation time atomically, removing a redundant read before each save. Redeploy the Convex server functions before upgrading the application runtime so both sides use the updated snapshot upsert behavior.
