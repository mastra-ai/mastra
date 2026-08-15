---
'@mastra/core': patch
---

Fixed durable agents pausing between model steps by suppressing unused internal workflow step events that repeatedly serialized cumulative conversation state.
