---
'@mastra/client-js': patch
---

Fixed `agent.generate()` and `agent.generateLegacy()` running only the first client tool when the model called several in one step. All client tools now run and their results go back to the agent together. If the request is aborted partway, no further client tools start.
