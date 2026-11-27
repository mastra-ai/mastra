---
'@mastra/core': patch
---

Fixed durable and evented agents copying the run's input message, including any file or image parts, into every saved workflow snapshot. When the agent has a fixed memory, snapshots after the run starts now store a reference to the input message the agent saved to memory before the run started, so large attachments no longer make every checkpoint larger. Fixes #31237.
