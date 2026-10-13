---
'@mastra/server': patch
---

Request bodies can no longer set the `mastra__knowledgeResourceId` request-context key; only server middleware can, like the other reserved keys.
