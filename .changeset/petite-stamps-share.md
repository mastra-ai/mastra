---
'@mastra/core': patch
---

Fixed agent loop hanging indefinitely when the model stream stalls after tool calls. The abort signal is now wired into the stream reader so that aborting a stalled agent run works immediately instead of requiring the stream to produce another chunk first.
