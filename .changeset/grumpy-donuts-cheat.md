---
'@mastra/core': patch
---

Fixed an agent reply loop on the iMessage channel. iPhone read receipts arrive as inbound messages with no text and no attachments, and each agent reply triggered another receipt. Channel messages with neither text nor attachments no longer start an agent run. Custom channel handlers still receive them.
