---
'@mastra/core': patch
---

Fix agent.generate() to use model's doGenerate method instead of doStream

When calling `agent.generate()`, the model's `doGenerate` method is now correctly invoked instead of always using `doStream`. This aligns the non-streaming generation path with the intended behavior where providers can implement optimized non-streaming responses.
