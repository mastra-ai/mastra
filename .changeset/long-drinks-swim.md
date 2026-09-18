---
'@mastra/core': patch
---

Fixed structured output with a top-level array of primitives (e.g. `z.array(z.string())` or `z.array(z.number())`) silently resolving `response.object` to an empty array. Array elements that are strings, numbers, booleans or null are now returned from `generate()`, `stream().object` and `objectStream`, and the final result is validated against what the model actually returned. Fixes #23980.
