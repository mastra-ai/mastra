---
'@mastra/core': patch
---

Fixed tool approval cards in channel threads accepting a click from any user after a restart. Only the user whose message led to the approval may answer it again, unless `toolApprovers` is `'anyone'`.
