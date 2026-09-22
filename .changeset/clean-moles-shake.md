---
'@mastra/core': patch
---

Fixed streamed tool events and assistant messages to retain their originating thread when a session switches threads. Consumers can use tool-event threadId to ignore delayed output from a previous conversation.
