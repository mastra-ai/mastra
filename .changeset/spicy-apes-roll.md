---
'@mastra/memory': patch
---

Fixed the recall tool throwing "Either cursor or threadId is required" when browsing messages with thread-scoped retrieval. In thread scope, the tool now falls back to the current thread when no cursor is given, and error messages explain how to proceed when no thread context can be resolved.
