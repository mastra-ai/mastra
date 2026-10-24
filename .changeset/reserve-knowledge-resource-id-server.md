---
'@mastra/server': patch
---

Fixed request-context handling so request bodies cannot set `mastra__knowledgeResourceId`. Server middleware can still set this key.
