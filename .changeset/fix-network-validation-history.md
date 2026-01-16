---
"@mastra/core": patch
---

Fix network validation not seeing previous iteration results in multi-step tasks

The validation LLM was unable to determine task completion for multi-step tasks because it couldn't see what primitives had already executed. Now includes a compact list of completed primitives in the validation prompt.
