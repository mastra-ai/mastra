---
'@mastra/core': patch
---

Fixed `agent.observe()` on durable and evented agents reporting an incomplete conversation when the observer runs in another process or on another agent instance. `output.messages`, the `onFinish` messages and scorer output could miss the final answer, or show the conversation as of an earlier step. The observer now takes each step's response messages from the run's stream.

Also fixed `stream()` and `generate()` on an evented agent whose steps run on workers in another process, for example an API server started with `MASTRA_WORKERS=false`. Their `onFinish` messages and `output.messages` now include the response, not only the prompt.
