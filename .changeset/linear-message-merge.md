---
'@mastra/core': patch
---

Fixed assistant message merging slowing down quadratically with the number of message parts. A step with thousands of reasoning items (common with OpenAI Responses reasoning) could previously block the event loop for tens of seconds; merging is now linear and produces the same merged messages.
