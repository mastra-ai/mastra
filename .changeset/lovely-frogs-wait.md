---
'@mastra/core': patch
---

fix(core): Validate structured output at text-end instead of flush

Fixes structured output validation for Bedrock and LMStudio by moving validation from `flush()` to `text-end` chunk. Eliminates `finishReason` heuristics, adds special token extraction for LMStudio, and validates at the correct point in stream lifecycle.
