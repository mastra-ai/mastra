---
'@mastra/react': patch
---

Make useChat Stop explicitly cancel durable execution, including runs without a memory thread, instead of only disconnecting the response stream.
