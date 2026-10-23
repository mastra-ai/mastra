---
'@mastra/factory': patch
---

Fixed duplicate "finished" notices from Factory sessions. After a session reported that it was done, every later run that ended with nothing new (for example, one woken by a PR comment or CI result) sent its followers another "finished" notice. Followers now hear it once; a failure or a session waiting on an answer is still reported.
