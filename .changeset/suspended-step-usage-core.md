---
'@mastra/core': patch
---

Fixed token usage being dropped when a tool call suspends or waits for approval. A suspended `stream()` or `generate()` now reports the suspended step's tokens in `usage` and `totalUsage`, and the model generation span records them. When the run resumes, the resumed call reports only the tokens it used, so the suspended step is no longer counted twice. See #27232.
