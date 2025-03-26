---
'@mastra/memory': patch
---

Removed working memory tool calls from thread history after the working memory has been updated. This is to prevent updates from polluting the context history and confusing agents. They should only see the most recent copy of working memory
