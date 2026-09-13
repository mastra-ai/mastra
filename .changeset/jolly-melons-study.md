---
'mastra': patch
---

Added an explicit Queue or Steer choice when sending messages during an active Studio agent response. Queue is the default and runs each message as a separate turn; idle chats retain the Send action. Delivery labels are temporary: queued labels clear when their runs start, and steering labels clear when their runs finish, fail, or are cancelled.
