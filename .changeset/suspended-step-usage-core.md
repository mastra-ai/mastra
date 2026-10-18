---
'@mastra/core': patch
---

Fixed token usage being dropped when a tool call suspends or waits for approval. A suspended `stream()` or `generate()` now includes the suspended step's tokens in `usage` and `totalUsage`, and the model generation span records them. After the run resumes, `totalUsage` stays cumulative for the whole run and counts the suspended step once. See #27232.
