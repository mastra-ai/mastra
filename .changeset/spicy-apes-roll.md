---
'@mastra/memory': patch
---

Fixed the recall tool throwing "Either cursor or threadId is required" when browsing messages with thread-scoped retrieval. The tool now defaults to the current thread in both thread and resource scope, and error messages explain how to proceed when no thread context exists.
