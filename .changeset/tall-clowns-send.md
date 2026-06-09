---
'@mastra/react': patch
---

Fixed user messages with attachments rendering as two separate bubbles while streaming. A message sent with an image, PDF, or text file now appears as a single bubble (text and attachment together) during streaming, matching how it looks after reloading the conversation from memory.
