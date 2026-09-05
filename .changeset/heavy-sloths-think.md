---
'@mastra/core': patch
---

Fixed durable agents entering a new tool approval wait or executing a tool after cancellation during response processing. Completed usage now reaches the normal final processors, and closed waits no longer return in saved messages.
