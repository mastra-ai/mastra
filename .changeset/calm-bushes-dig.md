---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` failing with `Cannot read properties of undefined (reading 'messages')` or `(reading 'length')` when a default-engine run was killed while a tool was running or between steps. Running checkpoints now keep the conversation state a restart reads back, while still trimming older history to keep storage small.
