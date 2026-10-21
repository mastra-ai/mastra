---
'@mastra/core': patch
---

Fixed `observe()` hanging forever on a durable or evented agent run that was aborted while waiting for tool approval. Once the rejected approval or resume releases the run, observers now receive the `abort` and `finish` chunks and close.
