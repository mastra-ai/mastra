---
'@mastra/core': patch
---

Durable and evented agents now keep the user's message in memory when `modelSettings.timeout.totalMs` fires before or during the initial input save. Previously the message was dropped and the thread lost the request. The run still stops with one `MastraTimeoutError` and never calls the model. Runs that another process took over, and runs with read-only memory, still save nothing.
