---
'@mastra/core': patch
---

Fixed a crash when a durable or evented agent run failed mid-stream and was then aborted. The run's output promises were rejected when the model call failed, and then resolved again as the stream closed, which built a second rejected promise that nothing was awaiting. Node reported the original provider error as an unhandled rejection, and with the default `--unhandled-rejections=throw` the process exited even though the caller had already handled the error chunk.

Rejecting an output promise is now final: resolving it afterwards is a no-op. Repeated resolution for durable suspend and resume is unchanged.
