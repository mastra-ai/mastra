---
'@mastra/core': patch
---

Fixed token usage being counted twice after a tool call suspends and the run resumes. Spans and metrics for the resumed run now report only the tokens used after resuming, including when the resumed run suspends again.
