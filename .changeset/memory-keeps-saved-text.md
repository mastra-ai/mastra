---
'@mastra/memory': patch
---

Fixed saved messages losing their leading and trailing newlines. Memory now trims a message's text only when it removed working-memory tags from it, so a reloaded message reads exactly as the model saw it and the next run can reuse the provider's prompt cache instead of sending the rest of the conversation again.
