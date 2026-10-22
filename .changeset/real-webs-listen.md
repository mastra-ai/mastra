---
'@mastra/react': patch
---

Make useChat Stop explicitly cancel durable execution, including runs without a memory thread, instead of only disconnecting the response stream. Fall back to transport cancellation without logging an error when an older server does not support the cancellation endpoint.
