---
'@mastra/core': patch
---

Fixed durable and evented agents ignoring later changes to the agent they wrap. Knowledge, retry settings, and model-list edits made on the wrapped agent or through the wrapper now apply to wrapped runs.
