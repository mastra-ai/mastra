---
'@mastra/convex': patch
---

Fixed single and batched workflow snapshot saves to preserve their original creation time atomically, removing a redundant read before each full snapshot save. Redeploy the Convex server functions before upgrading the application runtime so both sides use the updated snapshot upsert behavior.
