---
'@mastra/server': patch
---

Setting an agent controller goal on a session that has no thread yet now creates the thread instead of returning a 400 error. Updating or clearing a goal on such a session is a no-op.
