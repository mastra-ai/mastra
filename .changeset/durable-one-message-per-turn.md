---
'@mastra/core': patch
---

Fixed durable agents saving each step of a turn as a separate message. A multi-step turn is now saved as one message, as with `Agent`. Conversation history now holds more turns, and the streamed message ID matches the saved message.
