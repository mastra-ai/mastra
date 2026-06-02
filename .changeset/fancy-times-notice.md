---
'@mastra/core': patch
---

Fixed OpenAI Responses API replay so duplicate provider response items from persisted assistant history, including reasoning and provider tool-call item ids, are sent only once.
