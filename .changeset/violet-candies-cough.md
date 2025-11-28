---
'@mastra/core': patch
---

Fixed OpenAI reasoning message merging so distinct reasoning items are no longer dropped when they share a message ID. Prevents downstream errors where a function call is missing its required "reasoning" item. See #9005.