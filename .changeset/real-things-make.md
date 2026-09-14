---
'@mastra/client-js': patch
---

Fixed pending-message recovery after refresh with `session.listMessagesWithActiveInput(threadId, limit)`. It combines stored history and current local run inputs by message ID, keeping the stored copy and chronological order.
