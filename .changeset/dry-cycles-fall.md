---
'@mastra/memory': patch
---

Fixed `observe({ messages })` hiding messages that were never summarized. When you passed only part of a thread (for example, the oldest messages), the marker that records what has been summarized was placed on the newest assistant message instead of the last message you passed. Newer user messages, assistant replies, and tool results were then dropped from the next prompt without ever being summarized. The marker now stays within the messages that were actually summarized ([#21657](https://github.com/mastra-ai/mastra/issues/21657)).
