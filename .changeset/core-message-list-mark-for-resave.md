---
'@mastra/core': patch
---

Added `MessageList.markForResave(message)`, which marks a message already in the list so the next save writes it again through the normal whole-message save. Marked messages are not reported as new input, response or source messages, survive a failed save's restore, and are picked up by the memory message-history save. Observational Memory uses it to save token counts it adds to stored history. A marked message is saved again on each later turn of the same run, as an upsert of the same message, so a count is not written exactly once.
