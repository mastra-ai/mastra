---
'@mastra/memory': patch
---

Fix crash in updateMessageToHideWorkingMemoryV2 when message.content is not a V2 object. Added defensive type guards before spreading content to handle legacy or malformed message formats.
