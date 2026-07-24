---
'@mastra/core': patch
---

Fixed thread title generation using messages from other threads when memory is resource-scoped. Titles for new threads are now derived only from the messages of the thread being titled, instead of the full message list which can include recalled messages from the user's other conversations.
