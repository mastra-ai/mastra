---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed rotated response message IDs in streamed agent output and persistence.

Processors that run outside the agent loop no longer need synthetic response message IDs.
