---
'@mastra/core': patch
---

Fixed aborting suspended agent runs so parked tool calls are denied, the thread is released, and messages sent immediately after Stop receive a response.
