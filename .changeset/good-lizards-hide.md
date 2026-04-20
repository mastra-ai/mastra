---
'@mastra/core': patch
---

Fixed structured output runs so nested structuring agents keep their request context isolated and no longer leave the parent memory config in read-only mode.
