---
'@mastra/memory': patch
---

`recall()` now only returns messages from the requested thread or resource, even if the vector store returns results outside its filter or labels them with the wrong thread or resource. `searchMessages()` now skips observation results whose thread or resource metadata is outside the requested scope, even if the vector store ignores its filter.
