---
'@mastra/memory': patch
---

`recall()` and `searchMessages()` now only return messages and observations from the requested thread or resource, even if the vector store returns results outside its filter or with the wrong thread or resource on them.
