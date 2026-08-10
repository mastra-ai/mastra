---
'@mastra/core': patch
---

Fixed output processors not being able to clear the final agent text. An output processor that redacts all assistant text to an empty string now correctly results in an empty `result.text` from `generate()` and `stream()`, instead of falling back to the original unprocessed model output. Fixes #19240
