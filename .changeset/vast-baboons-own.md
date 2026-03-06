---
'@mastra/core': patch
---

Added processor-driven response message ID rotation so streamed assistant IDs use the rotated ID.

Processors that run outside the agent loop no longer need synthetic response message IDs.
